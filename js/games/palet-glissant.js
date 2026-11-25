// Palet glissant : une table de hockey sur coussin d'air. Chacun déplace sa crosse au doigt dans sa moitié
// et tente d'envoyer le palet dans le but d'en face. Seul contre un robot, ou à deux face à face.
// La table se met en long dans le sens de l'écran (debout : buts en haut et en bas ; couché : à gauche et à droite).
import { SEATS, robotArt } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { createStage, createLoop, artImage, text, createParticles } from "../core/stage.js";
import { h } from "../core/ui.js";

const TW = 1000, TL = 1600;      // table : largeur et longueur (le joueur 0 en bas, le joueur 1 en haut)
const MALLET = 72, PUCK = 44;
const WALL = 34;
const FRICTION = 0.35, MAX = 2300, MALLET_MAX = 2800;
const INK = "#2B2350";

// Niveaux solo : force du robot, buts pour gagner, largeur des buts, plots au milieu, deux palets.
const LEVELS = [
  { robot: 1, to: 3, mouth: 420, bumpers: 0, pucks: 1, goal: "Pousse le palet avec ta crosse jusque dans le but du robot !" },
  { robot: 1, to: 4, mouth: 400, bumpers: 0, pucks: 1, goal: "Le premier à 4 buts gagne. Protège ton but !" },
  { robot: 2, to: 4, mouth: 400, bumpers: 0, pucks: 1, goal: "Un robot plus rapide. Tire fort !" },
  { robot: 2, to: 5, mouth: 400, bumpers: 1, pucks: 1, goal: "Un plot au milieu : le palet rebondit dessus." },
  { robot: 2, to: 5, mouth: 380, bumpers: 2, pucks: 1, goal: "Deux plots. Utilise-les pour surprendre le robot !" },
  { robot: 3, to: 5, mouth: 380, bumpers: 0, pucks: 1, goal: "Voici le robot fort. Il défend très bien !" },
  { robot: 3, to: 5, mouth: 320, bumpers: 0, pucks: 1, goal: "Des buts plus petits : vise bien !" },
  { robot: 3, to: 5, mouth: 360, bumpers: 2, pucks: 1, goal: "Le robot fort et deux plots." },
  { robot: 2, to: 5, mouth: 400, bumpers: 0, pucks: 2, goal: "Deux palets en même temps ! Regarde partout." },
  { robot: 3, to: 7, mouth: 380, bumpers: 2, pucks: 2, goal: "Le défi des champions : deux palets, deux plots, le robot fort !" }
];
const FREE = { robot: 3, to: 7, mouth: 380, bumpers: 1, pucks: 1 };
const MULTI = { to: 5, mouth: 400, bumpers: 0, pucks: 1 };
const ROBOT = {
  1: { speed: 900, react: 0.22, aim: 0.55 },
  2: { speed: 1450, react: 0.12, aim: 0.8 },
  3: { speed: 2100, react: 0.05, aim: 0.95 }
};

const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const setup = solo ? (level || FREE) : MULTI;
  const players = solo
    ? [ctx.seats[0], { ...SEATS[1], kind: "robot", level: setup.robot, label: "Robot", art: robotArt(setup.robot), boost: 0, index: 1 }]
    : ctx.seats;
  const scores = [0, 0];
  const GOAL = setup.mouth;

  // Table couchée si l'écran est plus large que haut.
  const flat = innerWidth > innerHeight;
  const stage = createStage(root, { width: flat ? TL : TW, height: flat ? TW : TL, background: "#1F2D5C" });
  const g = stage.ctx;
  const particles = createParticles();
  const toTable = (x, y) => flat ? { x: TW - y, y: x } : { x, y };

  const bumpers = setup.bumpers === 1 ? [{ x: TW / 2, y: TL / 2, r: 60 }]
    : setup.bumpers === 2 ? [{ x: TW * 0.28, y: TL / 2, r: 52 }, { x: TW * 0.72, y: TL / 2, r: 52 }] : [];

  const mallets = players.map((p, i) => ({
    seat: i, p, r: MALLET + (p.boost || 0) * 14,
    x: TW / 2, y: i === 0 ? TL - 220 : 220, vx: 0, vy: 0, tx: TW / 2, ty: i === 0 ? TL - 220 : 220,
    image: artImage(p.kind === "robot" ? robotArt(p.level) : p.art), ai: { wait: 0 }
  }));
  let pucks = [];
  let phase = "ready", timer = 1.6, message = null, last = 0;

  function servePuck(toward) {
    // Le palet repart devant celui qui vient d'encaisser le but.
    const y = toward === 0 ? TL / 2 + 180 : TL / 2 - 180;
    return { x: TW / 2 + between(-120, 120), y, vx: 0, vy: 0, trail: [] };
  }
  function resetPucks(toward) {
    pucks = Array.from({ length: setup.pucks }, (_, k) => {
      const p = servePuck(k === 0 ? toward : 1 - toward);
      if (setup.pucks === 2) p.x = TW / 2 + (k ? 180 : -180);
      return p;
    });
  }

  /* ---------- Doigts ---------- */

  const fingers = new Map();
  const onDown = event => {
    if (phase === "done") return;
    const w = stage.toWorld(event.clientX, event.clientY), t = toTable(w.x, w.y);
    const seat = solo ? 0 : t.y > TL / 2 ? 0 : 1;
    if (players[seat]?.kind !== "human" || [...fingers.values()].includes(seat)) return;
    event.preventDefault();
    fingers.set(event.pointerId, seat);
    try { stage.canvas.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
    mallets[seat].tx = t.x; mallets[seat].ty = t.y;
  };
  const onMove = event => {
    const seat = fingers.get(event.pointerId);
    if (seat === undefined) return;
    const w = stage.toWorld(event.clientX, event.clientY), t = toTable(w.x, w.y);
    mallets[seat].tx = t.x; mallets[seat].ty = t.y;
  };
  const onUp = event => fingers.delete(event.pointerId);
  stage.canvas.addEventListener("pointerdown", onDown);
  stage.canvas.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => stage.canvas.addEventListener(type, onUp));

  /* ---------- Robot ---------- */

  // Le robot raisonne comme s'il était en haut ; pour le joueur du bas, on retourne la table.
  function think(m, dt) {
    const brain = ROBOT[m.p.level] || ROBOT[2];
    m.ai.wait -= dt;
    if (m.ai.wait > 0) return;
    m.ai.wait = brain.react;
    if (pucks.some(q => (q.stuck || 0) > 0.35 && Math.hypot(q.x - m.x, q.y - m.y) < m.r + PUCK + 60)) {
      const q = pucks.find(q2 => (q2.stuck || 0) > 0.35);
      const dx = m.x - q.x, dy = m.y - q.y, d = Math.hypot(dx, dy) || 1;
      m.tx = m.x + dx / d * 160 + (TW / 2 - m.x) * 0.3; m.ty = m.y + dy / d * 160;
      m.ai.wait = 0.6;
      return;
    }
    const fy = y => (m.seat === 0 ? TL - y : y);
    const mine = pucks.map(q => ({ x: q.x, y: fy(q.y), vy: m.seat === 0 ? -q.vy : q.vy }));
    // Le palet le plus dangereux : le plus proche de son but.
    const p = mine.reduce((a, b) => (b.y < a.y ? b : a));
    const me = { x: m.x, y: fy(m.y) };
    let tx, ty;
    if (p.y < TL / 2 + 40) {
      // Dans sa moitié : passer derrière le palet et frapper vers le but d'en face.
      const aimX = TW / 2 + between(-GOAL / 2, GOAL / 2) * (1 - brain.aim);
      const dx = aimX - p.x, dy = TL - p.y, d = Math.hypot(dx, dy) || 1;
      const behind = { x: p.x - dx / d * (PUCK + m.r * 0.6), y: p.y - dy / d * (PUCK + m.r * 0.6) };
      // Palet collé à un bord : impossible de passer derrière. Le robot retourne défendre et laisse le palet repartir.
      const reachable = behind.x > WALL + m.r * 0.8 && behind.x < TW - WALL - m.r * 0.8 && behind.y > WALL + m.r * 0.8;
      if (!reachable) { m.tx = TW / 2 + (p.x - TW / 2) * 0.3; m.ty = fy(200); return; }
      const ready = Math.hypot(me.x - behind.x, me.y - behind.y) < 50;
      tx = ready ? p.x + dx / d * 120 : behind.x;
      ty = ready ? p.y + dy / d * 120 : behind.y;
      if (p.y < me.y) { tx = p.x + (p.x < TW / 2 ? 90 : -90); ty = p.y - 120; }   // palet derrière lui : revenir défendre
    } else {
      // Dans l'autre moitié : se placer entre le palet et son but.
      tx = TW / 2 + (p.x - TW / 2) * 0.45;
      ty = 190 + (p.vy < 0 ? 0 : 60);
    }
    m.tx = tx; m.ty = fy(ty);
  }

  /* ---------- Physique ---------- */

  function moveMallet(m, dt) {
    const minY = m.seat === 0 ? TL / 2 + m.r : WALL + m.r;
    const maxY = m.seat === 0 ? TL - WALL - m.r : TL / 2 - m.r;
    const tx = clamp(m.tx, WALL + m.r, TW - WALL - m.r), ty = clamp(m.ty, minY, maxY);
    const limit = (m.p.kind === "robot" ? (ROBOT[m.p.level] || ROBOT[2]).speed : MALLET_MAX) * dt;
    let dx = tx - m.x, dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    if (d > limit) { dx *= limit / d; dy *= limit / d; }
    m.vx = dx / dt; m.vy = dy / dt;
    m.x += dx; m.y += dy;
  }

  function stepPuck(p, dt) {
    p.vx *= Math.exp(-FRICTION * dt); p.vy *= Math.exp(-FRICTION * dt);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX) { p.vx *= MAX / sp; p.vy *= MAX / sp; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    // Bords
    if (p.x < WALL + PUCK) { p.x = WALL + PUCK; p.vx = Math.abs(p.vx) * 0.9; bump(p); }
    if (p.x > TW - WALL - PUCK) { p.x = TW - WALL - PUCK; p.vx = -Math.abs(p.vx) * 0.9; bump(p); }
    const inGoal = Math.abs(p.x - TW / 2) < GOAL / 2 - PUCK * 0.4;
    if (p.y < WALL + PUCK && !inGoal) { p.y = WALL + PUCK; p.vy = Math.abs(p.vy) * 0.9; bump(p); }
    if (p.y > TL - WALL - PUCK && !inGoal) { p.y = TL - WALL - PUCK; p.vy = -Math.abs(p.vy) * 0.9; bump(p); }
    // Plots
    for (const b of bumpers) hitCircle(p, b.x, b.y, b.r, 0, 0, 0.95);
    // Crosses
    for (const m of mallets) if (hitCircle(p, m.x, m.y, m.r, m.vx, m.vy, 0.85)) {
      play("tap");
      particles.burst(p.x, p.y, "#ffffff", { count: 6, speed: 220, size: 6, life: 0.3 });
    }
    // Le palet reste sur la table : si une crosse l'écrase contre un bord, c'est la crosse qui recule.
    const inMouth = Math.abs(p.x - TW / 2) < GOAL / 2 - PUCK * 0.4;
    if (p.x <= WALL + PUCK) { p.x = WALL + PUCK; p.vx = Math.abs(p.vx) * 0.5; }
    if (p.x >= TW - WALL - PUCK) { p.x = TW - WALL - PUCK; p.vx = -Math.abs(p.vx) * 0.5; }
    if (!inMouth && p.y <= WALL + PUCK) { p.y = WALL + PUCK; p.vy = Math.abs(p.vy) * 0.5; }
    if (!inMouth && p.y >= TL - WALL - PUCK) { p.y = TL - WALL - PUCK; p.vy = -Math.abs(p.vy) * 0.5; }
    for (const m of mallets) {
      const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, min = m.r + PUCK;
      if (d < min) { m.x = p.x + dx / d * min; m.y = p.y + dy / d * min; }
    }
    // Palet presque arrêté contre un bord depuis un moment : petite poussée vers le milieu.
    const nearEdge = p.x < WALL + PUCK + 90 || p.x > TW - WALL - PUCK - 90 || p.y < WALL + PUCK + 90 || p.y > TL - WALL - PUCK - 90;
    // Bloqué = il reste au même endroit (il peut trembler très vite sans avancer).
    if (!p.anchor || Math.hypot(p.x - p.anchor.x, p.y - p.anchor.y) > 70) p.anchor = { x: p.x, y: p.y, t: 0 };
    p.anchor.t += dt;
    p.stuck = nearEdge ? p.anchor.t : 0;
    if (p.stuck > 1.4) {
      const dx = TW / 2 - p.x, dy = (p.y < TL / 2 ? TL * 0.3 : TL * 0.7) - p.y, d = Math.hypot(dx, dy) || 1;
      p.x += dx / d * 30; p.y += dy / d * 30;
      p.vx = dx / d * 520; p.vy = dy / d * 520; p.stuck = 0; p.anchor = null;
      // Les crosses trop proches s'écartent pour laisser partir le palet.
      for (const m of mallets) { const mx = m.x - p.x, my = m.y - p.y, md = Math.hypot(mx, my) || 1; if (md < m.r + PUCK + 50) { m.x += mx / md * 60; m.y += my / md * 60; } }
      particles.burst(p.x, p.y, "#7FD0F2", { count: 10, speed: 180, size: 7, life: 0.4 });
    }
  }
  function bump(p) { if (Math.hypot(p.vx, p.vy) > 300) play("tap"); }

  // Choc du palet contre un cercle (plot immobile ou crosse qui bouge).
  function hitCircle(p, x, y, r, vx, vy, bounce) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1, min = r + PUCK;
    if (d >= min) return false;
    const nx = dx / d, ny = dy / d;
    p.x = x + nx * min; p.y = y + ny * min;
    const rel = (p.vx - vx) * nx + (p.vy - vy) * ny;
    if (rel < 0) { p.vx -= (1 + bounce) * rel * nx; p.vy -= (1 + bounce) * rel * ny; }
    return true;
  }

  function goal(scorer) {
    scores[scorer]++;
    play("point");
    particles.burst(TW / 2, scorer === 0 ? 40 : TL - 40, players[scorer].color, { count: 30, speed: 420, size: 10, life: 1 });
    message = { text: "But !", seat: scorer };
    if (scores[scorer] >= setup.to) { phase = "done"; timer = 1.4; play("win"); return; }
    phase = "ready"; timer = 1.4;
    last = scorer;
    pucks = pucks.filter(p => p.y > 0 && p.y < TL);
    if (!pucks.length) resetPucks(1 - scorer);
  }

  function update(dt) {
    particles.update(dt);
    for (const m of mallets) { if (m.p.kind === "robot" && phase === "play") think(m, dt); moveMallet(m, dt); }
    if (phase === "ready") {
      timer -= dt;
      if (timer <= 0) { phase = "play"; message = null; if (!pucks.length) resetPucks(1 - last); play("go"); }
      return;
    }
    if (phase === "done") {
      timer -= dt;
      if (timer <= 0 && !finished) finish();
      return;
    }
    const steps = 4;
    for (let s = 0; s < steps; s++) for (const p of pucks) stepPuck(p, dt / steps);
    for (const p of [...pucks]) {
      p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 8) p.trail.shift();
      if (p.y < -PUCK) { pucks.splice(pucks.indexOf(p), 1); goal(0); if (phase !== "play") return; }
      else if (p.y > TL + PUCK) { pucks.splice(pucks.indexOf(p), 1); goal(1); if (phase !== "play") return; }
    }
    if (!pucks.length && phase === "play") resetPucks(1 - last);
  }

  let finished = false;
  function finish() {
    finished = true;
    if (solo) {
      const won = scores[0] > scores[1];
      const stars = !won ? 0 : scores[1] === 0 ? 3 : scores[1] <= 2 ? 2 : 1;
      ctx.finish({
        solo: {
          stars, value: scores[0] - scores[1], lowerIsBetter: false,
          format: v => `${v > 0 ? "+" : ""}${v} but${Math.abs(v) > 1 ? "s" : ""} d'écart`,
          label: `${scores[0]} à ${scores[1]}`,
          speech: won ? "Gagné ! Quel tireur !" : "Le robot a gagné cette fois !",
          next: stars === 3 ? "" : stars === 0 ? "1 étoile : battre le robot" : stars === 1 ? "2 étoiles : gagner en encaissant 2 buts au plus" : "3 étoiles : gagner sans encaisser de but"
        }
      });
      return;
    }
    ctx.finish({ ranking: scores.map((score, seat) => ({ seat, score, label: `${score} but${score > 1 ? "s" : ""}` })) });
  }

  /* ---------- Dessin ---------- */

  function drawTable() {
    const t = g;
    t.fillStyle = "#7FD0F2"; t.strokeStyle = INK; t.lineWidth = 8;
    t.beginPath(); t.roundRect(4, 4, TW - 8, TL - 8, 60); t.fill(); t.stroke();
    t.fillStyle = "#E9F8FF";
    t.beginPath(); t.roundRect(WALL, WALL, TW - WALL * 2, TL - WALL * 2, 44); t.fill();
    // Petits trous d'air
    t.fillStyle = "#C6E8F7";
    for (let x = WALL + 40; x < TW - WALL; x += 70) for (let y = WALL + 40; y < TL - WALL; y += 70) { t.beginPath(); t.arc(x, y, 3, 0, Math.PI * 2); t.fill(); }
    // Lignes
    t.strokeStyle = "#B9A6F2"; t.lineWidth = 8;
    t.beginPath(); t.moveTo(WALL, TL / 2); t.lineTo(TW - WALL, TL / 2); t.stroke();
    t.beginPath(); t.arc(TW / 2, TL / 2, 130, 0, Math.PI * 2); t.stroke();
    for (const i of [0, 1]) {
      const y = i === 0 ? TL - WALL : WALL;
      t.strokeStyle = players[i].color + "88"; t.lineWidth = 8;
      t.beginPath(); t.arc(TW / 2, y, GOAL / 2 + 40, i === 0 ? Math.PI : 0, i === 0 ? Math.PI * 2 : Math.PI); t.stroke();
      // But
      t.fillStyle = players[i].deep;
      t.beginPath(); t.roundRect(TW / 2 - GOAL / 2, i === 0 ? TL - WALL - 4 : -4, GOAL, WALL + 8, 10); t.fill();
    }
  }

  function drawMallet(m) {
    g.fillStyle = "#00000030";
    g.beginPath(); g.ellipse(m.x + 6, m.y + 10, m.r, m.r * 0.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = m.p.color; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = m.p.deep;
    g.beginPath(); g.arc(m.x, m.y, m.r * 0.66, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(m.x, m.y, m.r * 0.5, 0, Math.PI * 2); g.fill();
    if (m.image.complete && m.image.naturalWidth) {
      g.save(); g.translate(m.x, m.y); if (m.seat === 1 && !solo) g.rotate(Math.PI);
      g.beginPath(); g.arc(0, 0, m.r * 0.48, 0, Math.PI * 2); g.clip();
      const s = m.r * 1.15; g.drawImage(m.image, -s / 2, -s / 2, s, s); g.restore();
    }
  }

  function drawPuck(p) {
    p.trail.forEach((q, k) => { g.globalAlpha = k / p.trail.length * 0.25; g.fillStyle = INK; g.beginPath(); g.arc(q.x, q.y, PUCK * 0.8, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
    g.fillStyle = INK; g.beginPath(); g.arc(p.x, p.y, PUCK, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#FFC83D"; g.beginPath(); g.arc(p.x, p.y, PUCK * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffffaa"; g.beginPath(); g.arc(p.x - PUCK * 0.3, p.y - PUCK * 0.3, PUCK * 0.18, 0, Math.PI * 2); g.fill();
  }

  function draw() {
    stage.begin();
    g.save();
    if (flat) { g.translate(0, TW); g.rotate(-Math.PI / 2); }
    drawTable();
    for (const b of bumpers) {
      g.fillStyle = "#FF9AA8"; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "#ffffffaa"; g.beginPath(); g.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2); g.fill();
    }
    pucks.forEach(drawPuck);
    mallets.forEach(drawMallet);
    particles.draw(g);
    // Score de chacun, tourné vers lui, près de la ligne du milieu
    for (const i of [0, 1]) {
      const rot = i === 1 && !solo ? Math.PI : 0;
      text(g, String(scores[i]), TW - 110, i === 0 ? TL / 2 + 80 : TL / 2 - 80, { size: 90, color: players[i].color, stroke: "#fff", rotate: rot });
    }
    if (message) {
      const rot = message.seat === 1 && !solo ? Math.PI : 0;
      text(g, message.text, TW / 2, message.seat === 0 ? TL * 0.3 : TL * 0.7, { size: 120, color: "#fff", stroke: INK, rotate: rot });
    }
    if (phase === "ready" && !message) text(g, "Prêts ?", TW / 2, TL / 2 - 200, { size: 80, color: INK });
    g.restore();
  }

  const loop = createLoop(dt => { update(dt); draw(); });

  return {
    start() { resetPucks(1); loop.start(); say(solo ? "Envoie le palet dans le but du robot !" : "Le premier à cinq buts gagne !"); },
    pause() { loop.stop(); fingers.clear(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); }
  };
}

function demo() {
  const node = h(`<div class="pg-demo"><span class="pg-demo-goal"></span><span class="pg-demo-puck"></span><span class="pg-demo-mallet"></span></div>`);
  return { node, stop() {} };
}

export default {
  id: "palet-glissant",
  title: "Palet glissant",
  players: { min: 1, max: 2 },
  robots: true,
  theme: { bg: "#DDF3FF", ink: "#1F5C8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="22" y="6" width="116" height="108" rx="18" fill="#E9F8FF" stroke="#2B2350" stroke-width="4"/>
    <line x1="24" y1="60" x2="136" y2="60" stroke="#B9A6F2" stroke-width="3"/>
    <rect x="60" y="4" width="40" height="6" rx="3" fill="#BE3434"/><rect x="60" y="110" width="40" height="6" rx="3" fill="#1C5DB8"/>
    <circle cx="80" cy="92" r="13" fill="#2F80ED" stroke="#2B2350" stroke-width="3"/><circle cx="80" cy="28" r="13" fill="#EB5757" stroke="#2B2350" stroke-width="3"/>
    <circle cx="96" cy="62" r="8" fill="#2B2350"/><circle cx="96" cy="62" r="4" fill="#FFC83D"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Déplace ta crosse avec ton doigt et envoie le palet dans le but du robot. Protège ton but !"
      : "Chacun déplace sa crosse dans sa moitié de table. Envoie le palet dans le but d'en face ! Le premier à 5 buts gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
