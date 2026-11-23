// Les canons : chacun son tour, tirer en arrière pour viser le château des autres.
// Le vent change, le terrain se creuse à chaque tir. Dernier château debout gagne.
import { icon, shapeSVG, hasImage, imagePath } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, text, createParticles } from "../core/stage.js";

const W = 1600, H = 900, STEP = 4, COLS = W / STEP + 1;
const GRAVITY = 600, WIND = 95, CRATER = 54, BLAST = 72;
const HP = 3;
const S = 1.35;                 // taille des châteaux
const SOLO_CRATES = 6, SOLO_BALLS = 10, SOLO_SPARE = 2;   // défi libre

// Niveaux solo, dessinés à la main : terrain fixe (p1, p2 = ondulations, hill = sommet de la colline),
// caisses aux places choisies, boulets, boulets à garder pour 3 étoiles, vent
// (un nombre fixe, "random" = change à chaque tir, "strong" = fort et changeant).
const LEVELS = [
  { p1: 1.2, p2: 3.0, hill: 1150, crates: [720, 980], balls: 5, spare: 2, wind: 0, goal: "Deux caisses toutes proches. Pose ton doigt, tire en arrière, puis lâche !" },
  { p1: 2.5, p2: 0.5, hill: 1050, crates: [650, 1000, 1350], balls: 6, spare: 2, wind: 0, goal: "Trois caisses, de plus en plus loin. Tire plus fort pour les plus lointaines !" },
  { p1: 4.0, p2: 2.2, hill: 720, crates: [1000, 1250, 1480], balls: 6, spare: 2, wind: 0, goal: "Une grande colline au milieu : tire haut pour passer par-dessus !" },
  { p1: 0.3, p2: 5.1, hill: 1250, crates: [600, 880, 1150, 1450], balls: 6, spare: 1, wind: 0.25, goal: "Un petit vent pousse les boulets vers la droite. Regarde le drapeau !" },
  { p1: 5.5, p2: 1.4, hill: 900, crates: [700, 950, 1250, 1500], balls: 6, spare: 1, wind: -0.5, goal: "Le vent souffle vers toi : tire plus fort !" },
  { p1: 3.3, p2: 4.4, hill: 800, crates: [620, 840, 1060, 1300, 1520], balls: 7, spare: 2, wind: 0.5, goal: "Cinq caisses et un vent qui t'aide. Vise bien !" },
  { p1: 1.8, p2: 2.9, hill: 1150, crates: [620, 840, 1060, 1300, 1520], balls: 7, spare: 1, wind: "random", goal: "Le vent change à chaque tir : regarde le drapeau avant de tirer !" },
  { p1: 2.1, p2: 0.9, hill: 700, crates: [600, 800, 1000, 1200, 1400, 1550], balls: 8, spare: 2, wind: "random", goal: "Six caisses derrière une colline. Prends ton temps !" },
  { p1: 4.6, p2: 3.7, hill: 650, crates: [900, 1050, 1200, 1350, 1480, 1560], balls: 8, spare: 1, wind: "random", goal: "Toutes les caisses sont loin. Tire fort et haut !" },
  { p1: 0.8, p2: 5.9, hill: 750, crates: [560, 760, 980, 1180, 1380, 1550], balls: 7, spare: 1, wind: "strong", goal: "Le défi des champions : vent fort et peu de boulets !" }
];
const ROBOT = {
  1: { angle: 0.2, power: 0.14, think: 1.4 },
  2: { angle: 0.1, power: 0.07, think: 1.1 },
  3: { angle: 0.035, power: 0.03, think: 0.9 }
};
const CASTLE_X = { 1: [170], 2: [210, 1390], 3: [190, 800, 1410], 4: [160, 580, 1020, 1440] };
const CONFETTI = ["#2F80ED", "#EB5757", "#27AE60", "#F2C94C", "#7B61FF", "#FF9AA8"];

const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Terrain ---------- */

function makeTerrain(castles, solo, fixed = null) {
  const p1 = fixed ? fixed.p1 : Math.random() * 6, p2 = fixed ? fixed.p2 : Math.random() * 6;
  const hill = fixed ? fixed.hill : solo ? between(600, 900) : W / 2 + between(-150, 150);
  const ground = Array.from({ length: COLS }, (_, i) => {
    const x = i * STEP;
    const y = 650 - 70 * Math.sin(x / 270 + p1) - 40 * Math.sin(x / 115 + p2) - 170 * Math.exp(-(((x - hill) / 180) ** 2));
    return clamp(y, 360, 820);
  });
  // Un replat sous chaque château.
  for (const x of castles) {
    const i0 = Math.round(x / STEP);
    const level = ground[i0];
    for (let i = i0 - 14; i <= i0 + 14; i++) if (ground[i] !== undefined) ground[i] = level;
  }
  return ground;
}

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const players = ctx.seats;
  const stage = createStage(root, { width: W, height: H, background: hasImage("les-canons/fond-ciel.jpg") ? "#FFF6E8" : "#CDEBFF" });
  const g = stage.ctx;
  const particles = createParticles();
  // Images du lot 5 (null si absentes : on garde le dessin).
  const picture = name => hasImage(`les-canons/${name}`) ? artImage(`<img src="${imagePath(`les-canons/${name}`)}">`) : null;
  const IMG = { sky: picture("fond-ciel.jpg"), ball: picture("boulet.png"), base: picture("canon-socle.png"), tube: picture("canon-tube.png"), flag: picture("drapeau-vent.png"), boom: picture("explosion-rigolote.png") };
  const castleArt = name => ({ whole: picture(`chateau-${name}.png`), hurt: picture(`chateau-${name}-abime.png`) });
  const ready = img => img && img.complete && img.naturalWidth;
  let booms = [];

  const xs = CASTLE_X[players.length];
  const castles = players.map((p, i) => ({ seat: i, p, x: xs[i], y: 0, hp: HP, hits: 0, angle: i < players.length / 2 || solo ? -0.8 : -Math.PI + 0.8, flash: 0, image: artImage(p.art), art: castleArt((p.name || "bleu").toLowerCase()), out: false }));
  let ground = makeTerrain(xs, solo, level);
  const groundAt = x => {
    const f = clamp(x, 0, W) / STEP, i = Math.floor(f), k = f - i;
    return ground[i] * (1 - k) + (ground[Math.min(COLS - 1, i + 1)] ?? ground[i]) * k;
  };
  castles.forEach(c => { c.y = groundAt(c.x); });

  // Défi solo : des caisses à toucher avec un nombre de boulets limité.
  const crates = [];
  if (level) level.crates.forEach(x => crates.push({ x, y: groundAt(x), hit: false }));
  else if (solo) {
    while (crates.length < SOLO_CRATES) {
      const x = between(560, 1530);
      if (crates.some(c => Math.abs(c.x - x) < 120)) continue;
      crates.push({ x, y: groundAt(x), hit: false });
    }
  }
  let balls = level ? level.balls : SOLO_BALLS;
  const spare = level ? level.spare : SOLO_SPARE;
  const total = crates.length;

  const overlay = h(`<div class="cn-overlay">
    <div class="cn-banner" hidden><span class="cn-banner-art"></span><span class="cn-banner-text"></span></div>
  </div>`);
  root.append(overlay);
  const banner = overlay.querySelector(".cn-banner");

  let turn = -1, phase = "banner", timer = 0, wind = 0, shot = null, aim = null, eliminated = [], shotsFired = 0, robotPlan = null, message = null;

  const alive = () => castles.filter(c => !c.out);
  const active = () => castles[turn];

  function nextTurn() {
    if (solo) {
      if (crates.every(c => c.hit) || balls <= 0) return finishSolo();
      turn = 0;
    } else {
      if (alive().length <= 1) return finishMatch();
      do { turn = (turn + 1) % castles.length; } while (castles[turn].out);
    }
    // Le vent se lève après le premier tour de table.
    if (level) {
      wind = level.wind === "random" ? Math.round(between(-0.75, 0.75) * 4) / 4
        : level.wind === "strong" ? (Math.random() < 0.5 ? -1 : 1) * Math.round(between(0.5, 1) * 4) / 4
        : level.wind;
    } else {
      wind = shotsFired < (solo ? 2 : castles.length) ? 0 : Math.round(between(-1, 1) * 4) / 4;
    }
    phase = "banner";
    timer = solo && shotsFired > 0 ? 0.01 : 1.4;
    robotPlan = null;
    const c = active();
    if (!(solo && shotsFired > 0)) {
      banner.hidden = false;
      banner.style.setProperty("--seat", c.p.color);
      banner.querySelector(".cn-banner-art").innerHTML = c.p.art;
      banner.querySelector(".cn-banner-text").textContent = c.p.kind === "robot" ? `Au tour de ${c.p.label}` : solo ? "Vise les caisses !" : `À toi, ${c.p.label} !`;
      if (c.p.kind === "human") say(solo ? "Tire en arrière, puis lâche pour viser les caisses !" : `À toi, ${c.p.label} !`);
      play("pop");
    }
  }

  function startAim() {
    banner.hidden = true;
    phase = "aim";
    // Le canon se tourne d'emblée du bon côté (utile quand un voisin vient d'être battu).
    active().angle = fitAngle(active().angle, sideOf(active()));
    if (active().p.kind === "robot") robotPlan = planShot(active());
  }

  /* ---------- Tir ---------- */

  function muzzle(c, angle = c.angle) {
    const bx = c.x, by = c.y - 74 * S;
    return { x: bx + Math.cos(angle) * 54 * S, y: by + Math.sin(angle) * 54 * S };
  }

  const speedOf = power => 300 + 760 * power;

  function fire(c, angle, power) {
    c.angle = angle;
    const m = muzzle(c, angle);
    const v = speedOf(power);
    shot = { x: m.x, y: m.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, trail: [], owner: c };
    phase = "flight";
    shotsFired++;
    if (solo) balls--;
    particles.burst(m.x, m.y, "#ffffffcc", { count: 10, speed: 160, size: 9, life: 0.4 });
    play("go");
  }

  // Avance un boulet ; renvoie le point d'impact ou null.
  function advance(ball, dt, real = true) {
    ball.vx += wind * WIND * dt;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < -80 || ball.x > W + 80 || ball.y > H + 80) return { x: ball.x, y: ball.y, lost: true };
    if (ball.y >= groundAt(ball.x)) return { x: ball.x, y: groundAt(ball.x) };
    for (const c of castles) {
      if (c.out || (real === false && c === ball.owner)) continue;
      if (Math.abs(ball.x - c.x) < 40 * S && ball.y > c.y - 70 * S && ball.y < c.y) return { x: ball.x, y: ball.y };
    }
    return null;
  }

  function explode(at) {
    shot = null;
    phase = "settle";
    timer = 1.1;
    if (at.lost) { play("trap"); return; }
    // Le terrain se creuse.
    for (let i = 0; i < COLS; i++) {
      const dx = i * STEP - at.x;
      if (Math.abs(dx) >= CRATER) continue;
      const bottom = at.y + Math.sqrt(CRATER * CRATER - dx * dx);
      if (ground[i] < bottom) ground[i] = Math.min(H - 20, Math.max(ground[i], bottom));
    }
    booms.push({ x: at.x, y: at.y, age: 0 });
    particles.burst(at.x, at.y, "#93B86E", { count: 16, speed: 300, size: 8, life: 0.8, gravity: 600 });
    CONFETTI.forEach(color => particles.burst(at.x, at.y, color, { count: 5, speed: 340, size: 7, life: 1, gravity: 300 }));
    play("wrong");
    // Châteaux touchés.
    for (const c of castles) {
      if (c.out || Math.hypot(c.x - at.x, c.y - 35 * S - at.y) > BLAST * 1.15) continue;
      c.hp--;
      c.flash = 0.6;
      if (currentShooter && c !== currentShooter) currentShooter.hits++;
      if (c.hp <= 0) {
        c.out = true;
        eliminated.push(c);
        CONFETTI.forEach(color => particles.burst(c.x, c.y - 40, color, { count: 10, speed: 420, size: 9, life: 1.2, gravity: 400 }));
        message = `${c.p.label} est battu !`;
        play("win");
      } else {
        play("point");
      }
    }
    for (const crate of crates) {
      if (crate.hit || Math.hypot(crate.x - at.x, crate.y - 20 - at.y) > BLAST - 8) continue;
      crate.hit = true;
      particles.burst(crate.x, crate.y - 20, "#E2A35C", { count: 14, speed: 320, size: 9, life: 0.9, gravity: 500 });
      particles.burst(crate.x, crate.y - 20, "#FFC83D", { count: 8, speed: 260, size: 8, life: 0.9 });
      play("point");
    }
  }
  let currentShooter = null;

  /* ---------- Robots ---------- */

  function planShot(c) {
    const rules = ROBOT[c.p.level];
    const foes = castles.filter(o => !o.out && o !== c);
    const target = c.p.level === 3 ? foes.reduce((a, b) => (b.hp < a.hp ? b : a)) : foes[Math.floor(Math.random() * foes.length)];
    const towardLeft = target.x < c.x;
    let best = null;
    for (let a = 12; a <= 80; a += 2) {
      const angle = towardLeft ? -Math.PI + a * Math.PI / 180 : -a * Math.PI / 180;
      for (let power = 0.2; power <= 1.001; power += 0.025) {
        const m = muzzle(c, angle), v = speedOf(power);
        const ball = { x: m.x, y: m.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, owner: c };
        let hit = null;
        for (let t = 0; t < 7 && !hit; t += 1 / 60) hit = advance(ball, 1 / 60, false);
        if (!hit || hit.lost) continue;
        const miss = Math.hypot(hit.x - target.x, hit.y - (target.y - 35 * S));
        if (!best || miss < best.miss) best = { angle, power, miss };
      }
    }
    if (!best) best = { angle: towardLeft ? -Math.PI * 0.75 : -Math.PI * 0.25, power: 0.7 };
    return {
      angle: best.angle + between(-rules.angle, rules.angle),
      power: clamp(best.power + between(-rules.power, rules.power), 0.15, 1),
      wait: rules.think
    };
  }

  /* ---------- Visée au doigt : tirer en arrière puis lâcher ---------- */

  // Sens de tir imposé : le château le plus à gauche tire vers la droite, le plus à droite
  // vers la gauche. Ceux du milieu (à 3 ou 4) ont des adversaires des deux côtés : sens libre.
  function sideOf(c) {
    if (solo) return 1;
    const standing = alive().sort((a, b) => a.x - b.x);
    if (c === standing[0]) return 1;
    if (c === standing.at(-1)) return -1;
    return 0;
  }
  const RANGES = { 1: [-Math.PI / 2 + 0.03, -0.05], "-1": [-Math.PI + 0.05, -Math.PI / 2 - 0.03], 0: [-Math.PI + 0.05, -0.05] };

  // Ramène un angle dans l'intervalle permis, du côté le plus proche (jamais vers le sol).
  function fitAngle(angle, side) {
    const [low, high] = RANGES[side];
    if (angle >= low && angle <= high) return angle;
    const gap = target => Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)));
    return gap(low) < gap(high) ? low : high;
  }

  function aimFrom(start, point, side) {
    const dx = start.x - point.x, dy = start.y - point.y;
    const power = clamp(Math.hypot(dx, dy) / 260, 0, 1);
    return { angle: fitAngle(Math.atan2(dy, dx), side), power };
  }

  const onDown = event => {
    if (phase === "banner" && timer < 1.1) { timer = 0; return; }
    if (phase !== "aim" || active().p.kind !== "human" || aim) return;
    event.preventDefault();
    try { root.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
    const start = stage.toWorld(event.clientX, event.clientY);
    aim = { id: event.pointerId, start, angle: active().angle, power: 0 };
  };
  const onMove = event => {
    if (!aim || aim.id !== event.pointerId) return;
    const next = aimFrom(aim.start, stage.toWorld(event.clientX, event.clientY), sideOf(active()));
    aim.angle = next.angle;
    aim.power = next.power;
    active().angle = next.angle;
  };
  const onUp = event => {
    if (!aim || aim.id !== event.pointerId) return;
    const { angle, power } = aim;
    aim = null;
    if (phase === "aim" && power > 0.12) { currentShooter = active(); fire(active(), angle, power); }
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", () => { aim = null; });

  /* ---------- Boucle ---------- */

  function update(dt) {
    particles.update(dt);
    castles.forEach(c => {
      c.flash = Math.max(0, c.flash - dt);
      const floor = groundAt(c.x);
      if (c.y < floor) c.y = Math.min(floor, c.y + 400 * dt);   // le château glisse dans le cratère
    });
    if (phase === "banner") {
      timer -= dt;
      if (timer <= 0) startAim();
    } else if (phase === "aim" && robotPlan) {
      const c = active();
      robotPlan.wait -= dt;
      c.angle += clamp(robotPlan.angle - c.angle, -2.5 * dt, 2.5 * dt);
      if (robotPlan.wait <= 0 && Math.abs(robotPlan.angle - c.angle) < 0.02) {
        currentShooter = c;
        fire(c, robotPlan.angle, robotPlan.power);
      }
    } else if (phase === "flight" && shot) {
      for (let k = 0; k < 4 && shot; k++) {
        const hit = advance(shot, dt / 4);
        if (hit) { explode(hit); break; }
      }
      if (shot) {
        shot.trail.push({ x: shot.x, y: shot.y });
        if (shot.trail.length > 18) shot.trail.shift();
      }
    } else if (phase === "settle") {
      timer -= dt;
      if (timer <= 0) { message = null; nextTurn(); }
    }
  }

  function finishMatch() {
    phase = "done";
    const order = [...eliminated, ...alive()];
    ctx.finish({
      ranking: castles.map(c => ({
        seat: c.seat,
        score: order.indexOf(c) + 1 + (c.out ? 0 : 100),
        label: `${c.hits} touche${c.hits > 1 ? "s" : ""}`
      }))
    });
  }

  function finishSolo() {
    phase = "done";
    const hit = crates.filter(c => c.hit).length;
    const stars = hit === total ? (balls >= spare ? 3 : 2) : hit >= Math.ceil(total / 2) ? 1 : 0;
    const value = hit * 100 + balls;
    ctx.finish({
      solo: {
        stars, value, lowerIsBetter: false,
        format: v => `${Math.floor(v / 100)} caisses, ${v % 100} boulet${v % 100 > 1 ? "s" : ""} en réserve`,
        label: `${hit} caisse${hit > 1 ? "s" : ""} sur ${total}` + (hit === total ? ` · ${balls} boulet${balls > 1 ? "s" : ""} en réserve` : ""),
        speech: hit === total ? "Toutes les caisses sont tombées !" : `Tu as touché ${hit} caisse${hit > 1 ? "s" : ""} !`,
        next: stars === 3 ? "" : stars === 2 ? `3 étoiles : toutes les caisses avec ${spare} boulet${spare > 1 ? "s" : ""} en réserve` : stars === 1 ? "2 étoiles : toutes les caisses" : `1 étoile : toucher ${Math.ceil(total / 2)} caisses`
      }
    });
  }

  /* ---------- Dessin ---------- */

  function draw() {
    stage.begin();
    const t = performance.now() / 1000;
    if (ready(IMG.sky)) g.drawImage(IMG.sky, 0, 0, W, H);
    else {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#9FDBFF");
    sky.addColorStop(1, "#FFF1D6");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#FFE7A3";
    g.beginPath(); g.arc(1420, 120, 60, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) {
      const x = ((i * 430 + t * (14 + wind * 40)) % 1900 + 1900) % 1900 - 150, y = 90 + (i % 2) * 70;
      g.fillStyle = "#ffffffd0";
      [[0, 0, 46], [42, -14, 38], [80, 4, 34], [40, 12, 36]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); });
    }
    }
    // Terrain
    g.beginPath();
    g.moveTo(0, H);
    ground.forEach((y, i) => g.lineTo(i * STEP, y));
    g.lineTo(W, H);
    g.closePath();
    const dirt = g.createLinearGradient(0, 380, 0, H);
    dirt.addColorStop(0, "#B8D28E");
    dirt.addColorStop(1, "#8FB36A");
    g.fillStyle = dirt;
    g.fill();
    g.beginPath();
    ground.forEach((y, i) => (i ? g.lineTo(i * STEP, y) : g.moveTo(0, y)));
    g.strokeStyle = "#D2E6AE";
    g.lineWidth = 16;
    g.lineJoin = "round";
    g.stroke();
    g.strokeStyle = "#2B2350";
    g.lineWidth = 4;
    g.stroke();
    // Caisses
    for (const crate of crates) if (!crate.hit) drawCrate(crate);
    // Châteaux
    castles.forEach(drawCastle);
    // Visée : quelques points de la trajectoire, pas toute (sinon trop facile)
    const c = active();
    if (phase === "aim" && c && c.p.kind === "human") {
      const power = aim ? aim.power : 0;
      if (aim && power > 0.05) {
        const m = muzzle(c), v = speedOf(power);
        const ball = { x: m.x, y: m.y, vx: Math.cos(c.angle) * v, vy: Math.sin(c.angle) * v, owner: c };
        g.fillStyle = "#2B2350";
        for (let k = 1; k <= 26; k++) {
          if (advance(ball, 1 / 50, false)) break;
          if (k % 3 === 0) { g.globalAlpha = 1 - k / 30; g.beginPath(); g.arc(ball.x, ball.y, 6, 0, Math.PI * 2); g.fill(); }
        }
        g.globalAlpha = 1;
      }
      // Jauge de puissance
      g.fillStyle = "#ffffffd9";
      g.beginPath(); g.roundRect(c.x - 60, c.y + 22, 120, 22, 11); g.fill();
      g.fillStyle = power > 0.85 ? "#EB5757" : power > 0.5 ? "#F2C94C" : "#27AE60";
      g.beginPath(); g.roundRect(c.x - 56, c.y + 26, 112 * power, 14, 7); g.fill();
      if (!aim) text(g, "Tire en arrière", c.x, c.y + 70, { size: 30, color: "#fff", stroke: "#2B2350" });
    }
    if (shot) {
      shot.trail.forEach((p, i) => { g.globalAlpha = (i / shot.trail.length) * 0.5; g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, 4 + i * 0.4, 0, Math.PI * 2); g.fill(); });
      g.globalAlpha = 1;
      if (ready(IMG.ball)) {
        g.save(); g.translate(shot.x, shot.y); g.rotate(t * 8);
        g.drawImage(IMG.ball, -26, -26, 52, 52);
        g.restore();
      } else {
      g.fillStyle = "#2B2350";
      g.beginPath(); g.arc(shot.x, shot.y, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff88";
      g.beginPath(); g.arc(shot.x - 4, shot.y - 4, 4, 0, Math.PI * 2); g.fill();
      }
    }
    for (const b of booms) {
      b.age += 1 / 60;
      if (!ready(IMG.boom) || b.age > 0.7) continue;
      const size = 150 + b.age * 120;
      g.globalAlpha = Math.min(1, 2.2 - b.age * 3);
      g.drawImage(IMG.boom, b.x - size / 2, b.y - size * 0.6, size, size);
      g.globalAlpha = 1;
    }
    booms = booms.filter(b => b.age <= 0.7);
    particles.draw(g);
    drawWind();
    if (solo) {
      g.fillStyle = "#ffffffe0";
      g.beginPath(); g.roundRect(24, 22, 330, 70, 22); g.fill();
      text(g, `Boulets : ${balls}`, 44, 57, { size: 30, align: "left" });
      text(g, `Caisses : ${crates.filter(k => k.hit).length}/${total}`, 210, 57, { size: 30, align: "left" });
    }
    if (message) text(g, message, W / 2, 330, { size: 66, color: "#fff", stroke: "#2B2350" });
  }

  function drawWind() {
    const x = W / 2, y = 60;
    g.fillStyle = "#ffffffe0";
    g.beginPath(); g.roundRect(x - 130, y - 36, 260, 72, 24); g.fill();
    if (ready(IMG.flag)) {
      // Drapeau tourné dans le sens du vent ; il pend quand il n'y a pas de vent.
      g.save(); g.translate(x - 82, y);
      if (wind < 0) g.scale(-1, 1);
      if (!wind) g.rotate(0.9);
      g.drawImage(IMG.flag, -36, -36, 72, 72);
      g.restore();
    } else text(g, "Vent", x - 70, y, { size: 28 });
    if (!wind) { text(g, "calme", x + 40, y, { size: 26, color: "#6B6490", weight: 500 }); return; }
    const n = Math.round(Math.abs(wind) * 4), dir = Math.sign(wind);
    g.fillStyle = "#7B61FF";
    for (let k = 0; k < n; k++) {
      const ax = x + 2 + (dir > 0 ? k * 22 : (3 - k) * 22);
      g.beginPath();
      g.moveTo(ax + dir * 14, y); g.lineTo(ax - dir * 6, y - 14); g.lineTo(ax - dir * 6, y + 14); g.closePath();
      g.fill();
    }
  }

  function drawCrate(crate) {
    const s = 44;
    g.fillStyle = "#E2A35C";
    g.strokeStyle = "#8C5A2B";
    g.lineWidth = 5;
    g.beginPath(); g.roundRect(crate.x - s / 2, crate.y - s, s, s, 6); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(crate.x - s / 2 + 4, crate.y - s + 4); g.lineTo(crate.x + s / 2 - 4, crate.y - 4); g.stroke();
    g.fillStyle = "#FFC83D";
    g.beginPath(); g.arc(crate.x, crate.y - s - 18, 10, 0, Math.PI * 2); g.fill();
  }

  function drawCastle(c) {
    if (c.out) {
      g.fillStyle = "#8C7E70";
      g.beginPath(); g.roundRect(c.x - 44 * S, c.y - 22 * S, 88 * S, 22 * S, 6); g.fill();
      return;
    }
    const shake = c.flash > 0 ? Math.sin(c.flash * 60) * 4 : 0;
    const art = c.hp < HP && ready(c.art.hurt) ? c.art.hurt : c.art.whole;
    if (ready(art)) {
      g.save();
      g.translate(c.x + shake, c.y);
      if (c.flash > 0) g.filter = "brightness(1.6)";
      const size = 178;
      g.drawImage(art, -size / 2, -size * 0.875 + 4, size, size);
      g.filter = "none";
      g.restore();
      drawCannon(c, shake);
    } else {
    g.save();
    g.translate(c.x + shake, c.y);
    g.scale(S, S);
    // Canon (derrière la tour)
    g.save();
    g.translate(0, -74);
    g.rotate(c.angle);
    g.fillStyle = "#3A3F66";
    g.beginPath(); g.roundRect(0, -11, 54, 22, 9); g.fill();
    g.restore();
    // Tour
    g.fillStyle = c.flash > 0 ? "#fff" : c.p.color;
    g.beginPath(); g.roundRect(-40, -66, 80, 66, 8); g.fill();
    for (let k = 0; k < 4; k++) { g.beginPath(); g.roundRect(-40 + k * 22, -80, 14, 18, 3); g.fill(); }
    g.fillStyle = c.p.deep;
    g.beginPath(); g.roundRect(-13, -30, 26, 30, [13, 13, 0, 0]); g.fill();
    g.fillStyle = "#2B2350";
    g.beginPath(); g.arc(0, -74, 13, 0, Math.PI * 2); g.fill();
    // Avatar dans la fenêtre
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(0, -48, 15, 0, Math.PI * 2); g.fill();
    if (c.image.complete && c.image.naturalWidth) g.drawImage(c.image, -15, -63, 30, 30);
    g.restore();
    }
    // Cœurs
    if (!solo) for (let k = 0; k < HP; k++) text(g, k < c.hp ? "♥" : "♡", c.x - 36 + k * 36, c.y - 196, { size: 32, color: "#EB5757", stroke: "#fff" });
    if (active() === c && (phase === "aim" || phase === "banner")) {
      const bob = Math.sin(performance.now() / 160) * 6;
      g.fillStyle = c.p.color;
      g.strokeStyle = "#fff";
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(c.x, c.y - 168 * S + bob); g.lineTo(c.x - 18, c.y - 168 * S - 28 + bob); g.lineTo(c.x + 18, c.y - 168 * S - 28 + bob); g.closePath(); g.fill(); g.stroke();
    }
  }

  // Canon jouet (socle et tube du lot 5) posé en haut du château, là où partent les boulets.
  function drawCannon(c, shake) {
    const px = c.x + shake, py = c.y - 74 * S;
    if (ready(IMG.tube)) {
      const k = (54 * S) / 116;
      g.save(); g.translate(px, py); g.rotate(c.angle);
      if (Math.cos(c.angle) < 0) g.scale(1, -1);
      g.drawImage(IMG.tube, -120 * k, -128 * k, 256 * k, 256 * k);
      g.restore();
    }
    if (ready(IMG.base)) {
      const k = 0.36;
      g.save(); g.translate(px, py);
      if (Math.cos(c.angle) < 0) g.scale(-1, 1);
      g.drawImage(IMG.base, -128 * k, -122 * k, 256 * k, 256 * k);
      g.restore();
    }
  }

  const loop = createLoop(dt => { update(dt); draw(); });

  return {
    start() { nextTurn(); loop.start(); },
    pause() { loop.stop(); aim = null; },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); }
  };
}

/* ---------- Démonstration des règles ---------- */

function demo() {
  const node = h(`<div class="cn-demo">
    <div class="cn-demo-hill"></div>
    <span class="cn-demo-castle a"></span><span class="cn-demo-castle b"></span>
    <span class="cn-demo-ball"></span>
    <span class="cn-demo-finger">${icon("eclair")}</span>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "les-canons",
  title: "Les canons",
  players: { min: 1, max: 4 },
  robots: true,
  orientation: "landscape",
  theme: { bg: "#D8F0C8", ink: "#2F6B2A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <path d="M0 92 Q40 70 80 82 T160 76 V120 H0 Z" fill="#D9A066"/>
    <path d="M0 92 Q40 70 80 82 T160 76" fill="none" stroke="#6CBF5A" stroke-width="6"/>
    <rect x="16" y="62" width="30" height="26" rx="4" fill="#2F80ED"/><rect x="16" y="56" width="7" height="8" fill="#2F80ED"/><rect x="27" y="56" width="7" height="8" fill="#2F80ED"/><rect x="38" y="56" width="7" height="8" fill="#2F80ED"/>
    <rect x="114" y="54" width="30" height="26" rx="4" fill="#EB5757"/><rect x="114" y="48" width="7" height="8" fill="#EB5757"/><rect x="125" y="48" width="7" height="8" fill="#EB5757"/><rect x="136" y="48" width="7" height="8" fill="#EB5757"/>
    <rect x="30" y="46" width="22" height="9" rx="4" fill="#3A3F66" transform="rotate(-35 31 52)"/>
    <path d="M52 40 Q84 4 112 40" fill="none" stroke="#2B2350" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
    <circle cx="112" cy="40" r="6" fill="#2B2350"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Pose ton doigt, tire en arrière comme un lance-pierre, puis lâche. Fais tomber les 6 caisses avec 10 boulets. Attention au vent !"
      : "Chacun son tour : pose ton doigt, tire en arrière comme un lance-pierre, puis lâche ! Trois touches et le château est battu. Attention au vent !",
    demo
  },
  levels: LEVELS,
  mount
};
