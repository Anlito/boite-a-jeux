// Astro-balles : chacun défend son côté de l'écran avec une raquette.
// Une balle qui sort de ton côté te coûte un cœur. Évite la balle rouge, attrape les bonus.
import { SEATS, robotArt, icon } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, text, createParticles } from "../core/stage.js";

const W = 1000, R = 14, EDGE = 46, THICK = 22, PADDLE = 190;
const SIDES = { 1: ["bottom"], 2: ["bottom", "top"], 3: ["bottom", "top", "left"], 4: ["bottom", "top", "left", "right"] };
const ROBOT = { 1: { speed: 320, error: 70, react: 0.35 }, 2: { speed: 520, error: 35, react: 0.18 }, 3: { speed: 780, error: 12, react: 0.06 } };
const HEARTS = 3;

// Niveaux solo : robots adverses, vitesse de départ, balle rouge, bonus.
const LEVELS = [
  { robots: [1], speed: 380, hazard: false, bonus: false, goal: "Un robot facile en face de toi. Ne laisse pas passer la balle !" },
  { robots: [1], speed: 420, hazard: false, bonus: true, goal: "Des bonus apparaissent : touche-les avec la balle !" },
  { robots: [2], speed: 420, hazard: false, bonus: true, goal: "Un robot plus rapide. Vise les coins !" },
  { robots: [1, 1], speed: 420, hazard: false, bonus: true, goal: "Deux robots : un en face, un sur le côté." },
  { robots: [2], speed: 460, hazard: true, bonus: true, goal: "Attention à la balle rouge : ne la touche pas avec ta raquette !" },
  { robots: [1, 2], speed: 460, hazard: true, bonus: true, goal: "Deux robots et la balle rouge. Reste concentré !" },
  { robots: [3], speed: 480, hazard: true, bonus: true, goal: "Le robot fort. Il ne rate presque rien !" },
  { robots: [1, 1, 2], speed: 460, hazard: true, bonus: true, goal: "Trois robots, un de chaque côté !" },
  { robots: [2, 2, 3], speed: 500, hazard: true, bonus: true, goal: "Trois robots coriaces. Courage !" },
  { robots: [3, 3, 3], speed: 520, hazard: true, bonus: true, goal: "Le défi des champions : trois robots forts !" }
];
const FREE = { robots: [2, 2, 3], speed: 480, hazard: true, bonus: true };

const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const setup = solo ? (ctx.level || FREE) : { speed: 440, hazard: true, bonus: true };
  const people = solo
    ? [ctx.seats[0], ...setup.robots.map((force, k) => ({ ...SEATS[k + 1], kind: "robot", level: force, label: "Robot", art: robotArt(force), boost: 0, index: k + 1 }))]
    : ctx.seats;
  const sides = SIDES[people.length];
  const stage = createStage(root, { width: W, height: W, background: "#1C1745" });
  const g = stage.ctx;
  const particles = createParticles();

  const players = people.map((p, i) => ({
    seat: i, p, side: sides[i], pos: W / 2, target: W / 2, hearts: HEARTS, out: false, big: 0, flash: 0,
    length: PADDLE * (1 + (p.boost || 0) * 0.18), ai: { wait: 0, aim: W / 2 }
  }));
  const bySide = side => players.find(pl => pl.side === side && !pl.out);
  let balls = [], hazard = null, bonus = null, phase = "serve", timer = 2.2, clock = 0, bonusTimer = 8, hazardTimer = 14, eliminated = [], message = null;

  function serve() {
    balls = [];
    const alive = players.filter(pl => !pl.out);
    const toward = alive[Math.floor(Math.random() * alive.length)];
    const base = { bottom: Math.PI / 2, top: -Math.PI / 2, left: Math.PI, right: 0 }[toward.side];
    const a = base + between(-0.5, 0.5);
    balls.push({ x: W / 2, y: W / 2, vx: Math.cos(a) * setup.speed, vy: Math.sin(a) * setup.speed, last: null, trail: [] });
    phase = "serve";
    timer = 1.4;
  }

  /* ---------- Géométrie des côtés ---------- */

  // Ligne de la raquette d'un côté, et axe le long duquel elle glisse.
  const lineOf = side => ({ bottom: W - EDGE, top: EDGE, left: EDGE, right: W - EDGE })[side];
  const along = (side, ball) => (side === "bottom" || side === "top") ? ball.x : ball.y;
  const across = (side, ball) => (side === "bottom" || side === "top") ? ball.y : ball.x;
  const inward = side => ({ bottom: -1, top: 1, left: 1, right: -1 })[side];
  const half = pl => pl.length * (pl.big > 0 ? 1.45 : 1) / 2;

  /* ---------- Commandes ---------- */

  const fingers = new Map();
  function nearestSide(point) {
    const humans = players.filter(pl => pl.p.kind === "human" && !pl.out);
    let best = null, gap = Infinity;
    for (const pl of humans) {
      const d = { bottom: W - point.y, top: point.y, left: point.x, right: W - point.x }[pl.side];
      if (d < gap) { gap = d; best = pl; }
    }
    return solo ? players[0] : best;
  }
  function steer(pl, point) {
    pl.target = (pl.side === "bottom" || pl.side === "top") ? point.x : point.y;
  }
  const onDown = event => {
    const point = stage.toWorld(event.clientX, event.clientY);
    const pl = nearestSide(point);
    if (!pl || [...fingers.values()].includes(pl)) return;
    event.preventDefault();
    try { root.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
    fingers.set(event.pointerId, pl);
    steer(pl, point);
  };
  const onMove = event => {
    const pl = fingers.get(event.pointerId);
    if (pl) steer(pl, stage.toWorld(event.clientX, event.clientY));
  };
  const onUp = event => fingers.delete(event.pointerId);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel"].forEach(type => root.addEventListener(type, onUp));
  const keys = new Set();
  const onKey = event => {
    if (!["ArrowLeft", "ArrowRight", "q", "d"].includes(event.key)) return;
    event.preventDefault();
    event.type === "keydown" ? keys.add(event.key) : keys.delete(event.key);
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);

  /* ---------- Robots ---------- */

  function think(pl, dt) {
    const rules = ROBOT[pl.p.level];
    pl.ai.wait -= dt;
    if (pl.ai.wait <= 0) {
      pl.ai.wait = rules.react;
      // La balle la plus proche qui vient vers moi.
      const coming = balls.filter(b => (across(pl.side, b) - lineOf(pl.side)) * inward(pl.side) > 0 &&
        ({ bottom: b.vy > 0, top: b.vy < 0, left: b.vx < 0, right: b.vx > 0 })[pl.side]);
      const ball = coming.sort((a, b) => Math.abs(across(pl.side, a) - lineOf(pl.side)) - Math.abs(across(pl.side, b) - lineOf(pl.side)))[0];
      let aim = W / 2;
      if (ball) aim = along(pl.side, ball) + between(-rules.error, rules.error);
      // Éviter la balle rouge quand elle arrive.
      if (hazard && Math.abs(across(pl.side, hazard) - lineOf(pl.side)) < 260) {
        const h0 = along(pl.side, hazard);
        if (Math.abs(h0 - aim) < half(pl) + 40) aim = h0 < W / 2 ? h0 + half(pl) + 70 : h0 - half(pl) - 70;
      }
      pl.ai.aim = aim;
    }
    pl.target = pl.ai.aim;
    return rules.speed;
  }

  /* ---------- Simulation ---------- */

  function update(dt) {
    particles.update(dt);
    clock += dt;
    // Raquettes
    for (const pl of players) {
      if (pl.out) continue;
      pl.big = Math.max(0, pl.big - dt);
      pl.flash = Math.max(0, pl.flash - dt);
      let speed = 1800;
      if (pl.p.kind === "robot") speed = think(pl, dt);
      if (pl.seat === 0 && (keys.has("ArrowLeft") || keys.has("ArrowRight"))) pl.target = pl.pos + (keys.has("ArrowRight") - keys.has("ArrowLeft")) * 80;
      if (pl.seat === 1 && (keys.has("q") || keys.has("d"))) pl.target = pl.pos + (keys.has("d") - keys.has("q")) * 80;
      pl.pos += clamp(pl.target - pl.pos, -speed * dt, speed * dt);
      pl.pos = clamp(pl.pos, EDGE + half(pl), W - EDGE - half(pl));
    }
    if (phase === "serve") {
      timer -= dt;
      if (timer <= 0) { phase = "play"; play("go"); }
      return;
    }
    if (phase === "done") return;
    // Bonus et balle rouge
    if (setup.bonus) {
      bonusTimer -= dt;
      if (bonusTimer <= 0 && !bonus) { bonus = { x: between(320, 680), y: between(320, 680), kind: Math.random() < 0.5 ? "grand" : "multi", spin: 0 }; bonusTimer = between(9, 14); }
      if (bonus) bonus.spin += dt * 3;
    }
    if (setup.hazard) {
      hazardTimer -= dt;
      if (hazardTimer <= 0 && !hazard) {
        const a = Math.random() * Math.PI * 2;
        hazard = { x: W / 2, y: W / 2, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, warn: 1, trail: [] };
        hazardTimer = between(10, 16);
        play("trap");
      }
    }
    const steps = 3;
    for (let s = 0; s < steps && phase === "play"; s++) {
      for (const ball of [...balls]) moveBall(ball, dt / steps, false);
      if (hazard) {
        if (hazard.warn > 0) hazard.warn -= dt / steps;
        else moveBall(hazard, dt / steps, true);
      }
    }
    for (const ball of balls) { ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 10) ball.trail.shift(); }
  }

  function moveBall(ball, dt, isHazard) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    for (const side of ["bottom", "top", "left", "right"]) {
      const pl = bySide(side);
      const line = lineOf(side), dir = inward(side);
      const depth = (across(side, ball) - line) * dir;           // > 0 : dans le terrain
      const movingOut = ({ bottom: ball.vy > 0, top: ball.vy < 0, left: ball.vx < 0, right: ball.vx > 0 })[side];
      if (!movingOut) continue;
      if (!pl) {
        // Côté sans joueur : un mur.
        if (depth < R - EDGE + 6) bounceWall(ball, side);
        continue;
      }
      // Raquette
      if (depth < R + THICK / 2 && depth > -THICK && Math.abs(along(side, ball) - pl.pos) < half(pl) + R) {
        if (isHazard) {
          hurt(pl, "La balle rouge !");
          particles.burst(ball.x, ball.y, "#FF5267", { count: 18, speed: 300, size: 8, life: 0.6 });
          hazard = null;
          return;
        }
        hitPaddle(ball, pl);
        continue;
      }
      // Sortie
      if (depth < -R * 2) {
        if (isHazard) { hazard = null; return; }
        balls = balls.filter(b => b !== ball);
        particles.burst(clamp(ball.x, 20, W - 20), clamp(ball.y, 20, W - 20), pl.p.color, { count: 16, speed: 260, size: 8, life: 0.6 });
        hurt(pl, null);
        if (phase === "play" && !balls.length) serve();
        return;
      }
    }
    // Bonus
    if (!isHazard && bonus && Math.hypot(ball.x - bonus.x, ball.y - bonus.y) < 46) {
      const owner = ball.last;
      particles.burst(bonus.x, bonus.y, "#FFC83D", { count: 16, speed: 240, size: 8, life: 0.7 });
      play("star");
      if (bonus.kind === "multi") {
        const a = Math.atan2(ball.vy, ball.vx) + 0.6, v = Math.hypot(ball.vx, ball.vy);
        balls.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, last: owner, trail: [] });
      } else if (owner && !owner.out) {
        owner.big = 9;
      }
      bonus = null;
    }
  }

  function bounceWall(ball, side) {
    if (side === "bottom" || side === "top") ball.vy = -ball.vy; else ball.vx = -ball.vx;
    const line = lineOf(side) - inward(side) * (EDGE - R - 4);
    if (side === "bottom" || side === "top") ball.y = line; else ball.x = line;
  }

  function hitPaddle(ball, pl) {
    const offset = clamp((along(pl.side, ball) - pl.pos) / half(pl), -1, 1);
    const speed = Math.min(900, Math.hypot(ball.vx, ball.vy) * 1.05);
    const angle = offset * 1.0;                                  // jusqu'à environ 57° selon l'endroit touché
    const out = inward(pl.side);
    if (pl.side === "bottom" || pl.side === "top") {
      ball.vx = Math.sin(angle) * speed;
      ball.vy = out * Math.cos(angle) * speed;
      ball.y = lineOf(pl.side) + out * (THICK / 2 + R + 1);
    } else {
      ball.vy = Math.sin(angle) * speed;
      ball.vx = out * Math.cos(angle) * speed;
      ball.x = lineOf(pl.side) + out * (THICK / 2 + R + 1);
    }
    ball.last = pl;
    pl.flash = 0.15;
    particles.burst(ball.x, ball.y, pl.p.color, { count: 6, speed: 160, size: 6, life: 0.35 });
    play("tap");
  }

  function hurt(pl, why) {
    pl.hearts--;
    pl.flash = 0.6;
    play("wrong");
    if (why) message = { text: why, time: 1.2 };
    if (pl.hearts > 0) return;
    pl.out = true;
    eliminated.push(pl);
    message = { text: `${pl.p.label} est battu !`, time: 1.6 };
    const alive = players.filter(p => !p.out);
    if (solo && pl.seat === 0) return finish();
    // Plus personne à jouer, ou plus aucun enfant en jeu : inutile de regarder les robots finir entre eux.
    if (alive.length <= 1 || !alive.some(p => p.p.kind === "human")) finish();
  }

  function finish() {
    phase = "done";
    balls = [];
    hazard = null;
    setTimeout(() => {
      if (solo) {
        const me = players[0];
        const won = !me.out;
        const stars = won ? me.hearts : 0;
        ctx.finish({
          solo: {
            stars, value: won ? me.hearts : 0, lowerIsBetter: false,
            format: v => `${v} cœur${v > 1 ? "s" : ""}`,
            label: won ? `Gagné avec ${me.hearts} cœur${me.hearts > 1 ? "s" : ""} !` : "Les robots ont gagné cette fois.",
            speech: won ? "Tu as battu les robots !" : "Les robots ont gagné. Essaie encore !",
            next: stars === 3 ? "" : won ? `${stars + 1} étoiles : gagner avec ${stars + 1} cœurs` : "1 étoile : battre les robots"
          }
        });
        return;
      }
      const order = [...eliminated, ...players.filter(p => !p.out)];
      ctx.finish({ ranking: players.map(pl => ({ seat: pl.seat, score: pl.out ? order.indexOf(pl) + 1 : 100 + pl.hearts, label: pl.out ? "battu" : `${pl.hearts} cœur${pl.hearts > 1 ? "s" : ""}` })) });
    }, 1400);
  }

  /* ---------- Dessin ---------- */

  function draw() {
    stage.begin();
    const sky = g.createRadialGradient(W / 2, W / 2, 60, W / 2, W / 2, 720);
    sky.addColorStop(0, "#3B2F86");
    sky.addColorStop(1, "#1C1745");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 9 === 0 ? "#FFE7A3" : "#C9C2FF88";
      g.beginPath(); g.arc((i * 137 + 31) % W, (i * 271 + 57) % W, i % 9 === 0 ? 3 : 1.6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#FF9AA8aa"; g.beginPath(); g.arc(140, 160, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7FD0F2aa"; g.beginPath(); g.arc(870, 820, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffffff22"; g.lineWidth = 3; g.setLineDash([14, 16]);
    g.beginPath(); g.arc(W / 2, W / 2, 120, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    // Murs des côtés sans joueur
    for (const side of ["bottom", "top", "left", "right"]) {
      if (bySide(side)) continue;
      g.fillStyle = "#8E78C9";
      const t = 10;
      if (side === "bottom") g.fillRect(0, W - t, W, t);
      if (side === "top") g.fillRect(0, 0, W, t);
      if (side === "left") g.fillRect(0, 0, t, W);
      if (side === "right") g.fillRect(W - t, 0, t, W);
    }
    // Bonus
    if (bonus) {
      g.save(); g.translate(bonus.x, bonus.y); g.rotate(Math.sin(bonus.spin) * 0.3);
      g.fillStyle = "#FFC83D"; g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill();
      g.restore();
      text(g, bonus.kind === "multi" ? "×2" : "↔", bonus.x, bonus.y + 2, { size: 30, color: "#5A3A00" });
    }
    // Raquettes et cœurs
    for (const pl of players) {
      if (pl.out) continue;
      const len = half(pl) * 2, line = lineOf(pl.side);
      g.save();
      g.shadowColor = pl.p.color; g.shadowBlur = pl.flash > 0 ? 30 : 16;
      g.fillStyle = pl.flash > 0.3 ? "#fff" : pl.p.color;
      g.beginPath();
      if (pl.side === "bottom" || pl.side === "top") g.roundRect(pl.pos - len / 2, line - THICK / 2, len, THICK, THICK / 2);
      else g.roundRect(line - THICK / 2, pl.pos - len / 2, THICK, len, THICK / 2);
      g.fill();
      g.restore();
      const hearts = "♥".repeat(pl.hearts) + "♡".repeat(Math.max(0, HEARTS - pl.hearts));
      const pos = { bottom: [W / 2, W - 16, 0], top: [W / 2, 16, Math.PI], left: [16, W / 2, Math.PI / 2], right: [W - 16, W / 2, -Math.PI / 2] }[pl.side];
      text(g, hearts, pos[0], pos[1], { size: 34, color: "#FF9AA8", rotate: pos[2] });
    }
    // Balles
    for (const ball of balls) {
      ball.trail.forEach((p, i) => { g.globalAlpha = i / ball.trail.length * 0.4; g.fillStyle = "#87DFFF"; g.beginPath(); g.arc(p.x, p.y, R * (0.4 + i / 20), 0, Math.PI * 2); g.fill(); });
      g.globalAlpha = 1;
      g.save(); g.shadowColor = "#56CEFF"; g.shadowBlur = 24;
      g.fillStyle = "#D0F7FF"; g.beginPath(); g.arc(ball.x, ball.y, R, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (hazard) {
      const blink = hazard.warn > 0 && Math.floor(hazard.warn * 8) % 2;
      if (!blink) {
        g.save(); g.shadowColor = "#FF425C"; g.shadowBlur = 24;
        g.fillStyle = "#FF5267"; g.beginPath(); g.arc(hazard.x, hazard.y, R + 4, 0, Math.PI * 2); g.fill();
        g.restore();
        text(g, "!", hazard.x, hazard.y + 1, { size: 24, color: "#fff" });
      }
    }
    particles.draw(g);
    if (phase === "serve") text(g, "Prêt ?", W / 2, W / 2 + 70, { size: 56, color: "#fff", stroke: "#1C1745" });
    if (message) {
      message.time -= 1 / 60;
      text(g, message.text, W / 2, W / 2 - 80, { size: 50, color: "#fff", stroke: "#1C1745" });
      if (message.time <= 0) message = null;
    }
  }

  const loop = createLoop(dt => { update(dt); draw(); });
  return {
    start() { serve(); timer = 2.2; say(solo ? "Défends ton côté !" : "Chacun défend son côté !"); loop.start(); },
    pause() { loop.stop(); fingers.clear(); keys.clear(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKey); }
  };
}

function demo() {
  const node = h(`<div class="ab-demo"><span class="ab-paddle top"></span><span class="ab-ball"></span><span class="ab-paddle bottom"></span></div>`);
  return { node, stop() {} };
}

export default {
  id: "astro-balles",
  title: "Astro-balles",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#3B2F86", ink: "#3B2F86" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true"><rect width="160" height="120" rx="16" fill="#2C2470"/>
    <rect x="50" y="104" width="60" height="8" rx="4" fill="#2F80ED"/><rect x="50" y="8" width="60" height="8" rx="4" fill="#EB5757"/>
    <circle cx="96" cy="58" r="7" fill="#D0F7FF"/><circle cx="60" cy="70" r="8" fill="#FF5267"/></svg>`,
  rules: {
    text: session => session.count === 1
      ? "Glisse ton doigt pour bouger ta raquette en bas. Ne laisse pas passer la balle, et ne touche pas la balle rouge !"
      : "Chacun bouge sa raquette en glissant le doigt près de son bord. Une balle qui passe coûte un cœur. Évite la balle rouge ! Le dernier qui a des cœurs gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
