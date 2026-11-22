// Panier de fruits : glisser son panier pour attraper les fruits, éviter les bombes.
// Chaque joueur a son propre verger, avec exactement les mêmes fruits au même moment.
import { icon } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, text, createParticles, seatAt } from "../core/stage.js";

const W = 800, BASKET = 70;
const ITEMS = {
  pomme: { points: 1 }, poire: { points: 1 }, fraise: { points: 1 }, orange: { points: 1 },
  doree: { points: 3 }, bombe: { points: -2 }, aimant: { points: 0, power: "aimant" }, sablier: { points: 0, power: "sablier" }
};
const FRUITS = ["pomme", "poire", "fraise", "orange"];
const ROBOT = { 1: { speed: 260, error: 80, fear: 0.35 }, 2: { speed: 380, error: 45, fear: 0.7 }, 3: { speed: 560, error: 15, fear: 0.95 } };

// Niveaux solo : durée, rythme (secondes entre deux fruits au début et à la fin), chute, bombes, bonus, points pour 1/2/3 étoiles.
const LEVELS = [
  { time: 40, every: [1.15, 0.9], fall: [170, 230], bombs: 0, gold: 0.08, powers: false, stars: [15, 25, 35], goal: "Attrape le plus de fruits possible en 40 secondes !" },
  { time: 40, every: [1.1, 0.85], fall: [180, 250], bombs: 0.08, gold: 0.08, powers: false, stars: [16, 27, 37], goal: "Attention aux bombes : elles enlèvent 2 points !" },
  { time: 45, every: [1.05, 0.8], fall: [190, 260], bombs: 0.1, gold: 0.12, powers: false, stars: [20, 32, 44], goal: "Les pommes dorées valent 3 points. Ne les rate pas !" },
  { time: 45, every: [1, 0.75], fall: [200, 280], bombs: 0.12, gold: 0.1, powers: true, stars: [22, 35, 48], goal: "Un aimant attire les fruits dans ton panier, un sablier les ralentit !" },
  { time: 50, every: [0.95, 0.7], fall: [210, 300], bombs: 0.13, gold: 0.1, powers: true, stars: [26, 40, 55], goal: "Cinq fruits de suite sans en rater : les points comptent double !" },
  { time: 50, every: [0.9, 0.65], fall: [220, 320], bombs: 0.16, gold: 0.1, powers: true, stars: [28, 43, 58], goal: "Plus de bombes. Garde ta série !" },
  { time: 55, every: [0.85, 0.6], fall: [230, 340], bombs: 0.17, gold: 0.1, powers: true, stars: [32, 50, 68], goal: "Les fruits tombent plus vite !" },
  { time: 55, every: [0.8, 0.55], fall: [240, 360], bombs: 0.18, gold: 0.1, powers: true, stars: [35, 54, 74], goal: "Une vraie pluie de fruits !" },
  { time: 60, every: [0.75, 0.5], fall: [250, 380], bombs: 0.2, gold: 0.1, powers: true, stars: [40, 62, 85], goal: "Presque le niveau des champions !" },
  { time: 60, every: [0.7, 0.45], fall: [260, 400], bombs: 0.22, gold: 0.1, powers: true, stars: [44, 68, 92], goal: "Le défi des champions : 60 secondes de folie !" }
];
const FREE = { time: 60, every: [1, 0.5], fall: [200, 380], bombs: 0.18, gold: 0.1, powers: true, stars: [35, 55, 75] };
const MULTI = { time: 45, every: [1, 0.6], fall: [200, 330], bombs: 0.15, gold: 0.1, powers: true };

const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const setup = solo ? (ctx.level || FREE) : MULTI;
  const people = ctx.seats;
  const n = people.length;
  // Hauteur du verger selon la forme de la zone de chaque joueur (la même pour tous : c'est équitable).
  const zoneW = window.innerWidth / (n > 2 ? 2 : 1), zoneH = window.innerHeight / (n > 1 ? 2 : 1);
  const H = Math.round(clamp(W * zoneH / zoneW, 380, 1100));
  const BASKET_Y = H - 100;

  const node = h(`<div class="pf td n${n}">${people.map((p, i) => `<section class="pf-zone pos-${i}" data-seat="${i}"></section>`).join("")}</div>`);
  root.append(node);
  const flipped = i => n > 1 && (i === 1 || i === 3);
  const fields = people.map((p, i) => {
    const zone = node.querySelector(`.pf-zone.pos-${i}`);
    const stage = createStage(zone, { width: W, height: H, background: "#F7D9B5", flipped: flipped(i) });
    if (flipped(i)) stage.canvas.style.transform = "rotate(180deg)";
    return { seat: i, p, zone, stage, g: stage.ctx, particles: createParticles(), x: W / 2, target: W / 2, score: 0, streak: 0, items: [], magnet: 0, slow: 0, flash: null, ai: { wait: 0 } };
  });

  let clock = 0, next = 0.8, phase = "count", timer = 2.4, finished = false;

  /* ---------- Fruits ---------- */

  function spawn() {
    const progress = clock / setup.time;
    const roll = Math.random();
    let kind;
    if (clock > 3 && roll < setup.bombs) kind = "bombe";
    else if (roll < setup.bombs + setup.gold) kind = "doree";
    else if (setup.powers && roll > 0.965) kind = Math.random() < 0.5 ? "aimant" : "sablier";
    else kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const x = between(50, W - 50);
    // Même temps de chute quelle que soit la hauteur du verger.
    const fall = between(...setup.fall) * (0.9 + progress * 0.25) * (H / 600);
    // Le même fruit tombe dans tous les vergers, au même endroit, à la même vitesse.
    for (const f of fields) f.items.push({ kind, x, y: -30, fall, spin: Math.random() * 6 });
  }

  /* ---------- Commandes ---------- */

  const fingers = new Map();
  const zoneOf = event => {
    if (solo) return fields[0];
    return fields[seatAt(n, event.clientX, event.clientY, node.getBoundingClientRect())];
  };
  const onDown = event => {
    const f = zoneOf(event);
    if (!f || f.p.kind !== "human") return;
    event.preventDefault();
    fingers.set(event.pointerId, f);
    f.target = f.stage.toWorld(event.clientX, event.clientY).x;
  };
  const onMove = event => {
    const f = fingers.get(event.pointerId);
    if (f) f.target = f.stage.toWorld(event.clientX, event.clientY).x;
  };
  const onUp = event => fingers.delete(event.pointerId);
  node.addEventListener("pointerdown", onDown);
  node.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => node.addEventListener(type, onUp));
  const keys = new Set();
  const onKey = event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.type === "keydown" ? keys.add(event.key) : keys.delete(event.key);
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);

  /* ---------- Robots ---------- */

  function think(f, dt) {
    const rules = ROBOT[f.p.level];
    f.ai.wait -= dt;
    if (f.ai.wait > 0) return rules.speed;
    f.ai.wait = 0.2;
    // Le fruit le plus bas qu'on peut encore rattraper ; on fuit les bombes proches.
    const good = f.items.filter(it => it.kind !== "bombe" && it.y < BASKET_Y && it.y > 0)
      .filter(it => Math.abs(it.x - f.x) / rules.speed < (BASKET_Y - it.y) / it.fall + 0.1)
      .sort((a, b) => b.y - a.y)[0];
    let aim = good ? good.x + between(-rules.error, rules.error) : f.x;
    const bomb = f.items.find(it => it.kind === "bombe" && it.y > BASKET_Y - 160 && it.y < BASKET_Y && Math.abs(it.x - aim) < BASKET + 20);
    if (bomb && Math.random() < rules.fear) aim = bomb.x < W / 2 ? bomb.x + BASKET + 60 : bomb.x - BASKET - 60;
    f.target = aim;
    return rules.speed;
  }

  /* ---------- Simulation ---------- */

  function update(dt) {
    for (const f of fields) f.particles.update(dt);
    if (phase === "count") {
      timer -= dt;
      if (timer <= 0) { phase = "play"; play("go"); }
      return;
    }
    if (phase !== "play") return;
    clock += dt;
    const progress = Math.min(1, clock / setup.time);
    next -= dt;
    if (next <= 0 && clock < setup.time - 1.2) {
      spawn();
      next = setup.every[0] + (setup.every[1] - setup.every[0]) * progress;
    }
    for (const f of fields) {
      f.magnet = Math.max(0, f.magnet - dt);
      f.slow = Math.max(0, f.slow - dt);
      let speed = 2400;
      if (f.p.kind === "robot") speed = think(f, dt);
      if (f.seat === 0 && keys.size) f.target = f.x + (keys.has("ArrowRight") - keys.has("ArrowLeft")) * 90;
      f.x = clamp(f.x + clamp(f.target - f.x, -speed * dt, speed * dt), BASKET, W - BASKET);
      const half = BASKET * (1 + (f.p.boost || 0) * 0.2);
      for (const it of f.items) {
        const before = it.y;
        it.y += it.fall * dt * (f.slow > 0 ? 0.45 : 1);
        it.spin += dt * 2;
        if (f.magnet > 0 && it.kind !== "bombe" && it.y > 120) it.x += clamp(f.x - it.x, -260 * dt, 260 * dt);
        if (before < BASKET_Y && it.y >= BASKET_Y && Math.abs(it.x - f.x) <= half + 10) catchItem(f, it);
        else if (before < BASKET_Y + 40 && it.y >= BASKET_Y + 40 && it.kind !== "bombe" && ITEMS[it.kind].points > 0) f.streak = 0;
      }
      f.items = f.items.filter(it => !it.caught && it.y < H + 40);
      if (f.flash) { f.flash.time -= dt; if (f.flash.time <= 0) f.flash = null; }
    }
    if (clock >= setup.time) end();
  }

  function catchItem(f, it) {
    it.caught = true;
    const info = ITEMS[it.kind];
    if (it.kind === "bombe") {
      f.score = Math.max(0, f.score - 2);
      f.streak = 0;
      f.flash = { text: "−2", color: "#C62F2F", time: 0.8 };
      f.particles.burst(it.x, BASKET_Y, "#FF626D", { count: 18, speed: 300, size: 9, life: 0.6 });
      if (f.p.kind === "human") play("wrong");
      return;
    }
    if (info.power === "aimant") { f.magnet = 6; f.flash = { text: "Aimant !", color: "#7B61FF", time: 1 }; if (f.p.kind === "human") play("star"); return; }
    if (info.power === "sablier") { f.slow = 6; f.flash = { text: "Ralenti !", color: "#2F80ED", time: 1 }; if (f.p.kind === "human") play("star"); return; }
    f.streak++;
    const bonus = f.streak >= 5 ? 2 : 1;
    f.score += info.points * bonus;
    f.flash = { text: `+${info.points * bonus}`, color: bonus > 1 ? "#E59A00" : "#2F7A2A", time: 0.6 };
    f.particles.burst(it.x, BASKET_Y, it.kind === "doree" ? "#FFE161" : "#C6FF9B", { count: 10, speed: 220, size: 7, life: 0.5 });
    if (f.p.kind === "human" || solo) play(it.kind === "doree" ? "star" : "pop");
  }

  function end() {
    if (finished) return;
    finished = true;
    phase = "done";
    play("win");
    setTimeout(() => {
      if (solo) {
        const score = fields[0].score;
        const stars = setup.stars.filter(need => score >= need).length;
        ctx.finish({
          solo: {
            stars, value: score, lowerIsBetter: false,
            format: v => `${v} points`,
            label: `${score} point${score > 1 ? "s" : ""} en ${setup.time} secondes`,
            speech: `Tu as fait ${score} points !`,
            next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : ${setup.stars[stars]} points`
          }
        });
        return;
      }
      ctx.finish({ ranking: fields.map(f => ({ seat: f.seat, score: f.score, label: `${f.score} point${f.score > 1 ? "s" : ""}` })) });
    }, 900);
  }

  /* ---------- Dessin ---------- */

  function draw() {
    for (const f of fields) drawField(f);
  }

  function drawField(f) {
    const { g, stage } = f;
    stage.begin();
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#FFF1BB");
    sky.addColorStop(1, "#F4AE90");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = "#FFF8DA"; g.beginPath(); g.arc(660, Math.min(110, H * 0.15), 44, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 145, y = H * 0.25 + (i % 2) * 40;
      g.fillStyle = "#825F4A"; g.fillRect(x - 7, y, 14, H);
      g.fillStyle = "#537E59"; g.beginPath(); g.ellipse(x, y, 58, 48, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7DA663"; g.beginPath(); g.ellipse(x - 14, y - 16, 36, 30, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#6E9A57"; g.fillRect(0, H - 60, W, 60);
    for (const it of f.items) drawItem(g, it);
    // Panier
    const half = BASKET * (1 + (f.p.boost || 0) * 0.2);
    if (f.magnet > 0) { g.strokeStyle = "#7B61FF66"; g.lineWidth = 6; g.beginPath(); g.arc(f.x, BASKET_Y, 110 + Math.sin(clock * 10) * 6, Math.PI, 0); g.stroke(); }
    const weave = g.createLinearGradient(0, BASKET_Y, 0, BASKET_Y + 52);
    weave.addColorStop(0, "#D69650"); weave.addColorStop(1, "#805035");
    g.fillStyle = weave; g.beginPath(); g.roundRect(f.x - half, BASKET_Y, half * 2, 52, [8, 8, 22, 22]); g.fill();
    g.fillStyle = "#DBAB65";
    for (let bar = -half + 14; bar < half - 8; bar += 14) g.fillRect(f.x + bar, BASKET_Y + 12, 6, 30);
    g.fillStyle = f.p.color; g.beginPath(); g.roundRect(f.x - half - 4, BASKET_Y - 6, half * 2 + 8, 14, 7); g.fill();
    f.particles.draw(g);
    // Repères
    g.fillStyle = "#ffffffe6"; g.beginPath(); g.roundRect(16, 14, 180, 56, 28); g.fill();
    text(g, `${f.score}`, 70, 43, { size: 38, color: f.p.deep });
    text(g, f.streak >= 5 ? "×2" : "", 150, 43, { size: 30, color: "#E59A00" });
    g.fillStyle = "#ffffffe6"; g.beginPath(); g.roundRect(W - 136, 14, 120, 56, 28); g.fill();
    text(g, `${Math.max(0, Math.ceil(setup.time - clock))} s`, W - 76, 43, { size: 32 });
    if (f.flash) text(g, f.flash.text, f.x, BASKET_Y - 40, { size: 40, color: f.flash.color, stroke: "#fff" });
    if (phase === "count") text(g, String(Math.max(1, Math.ceil(timer / 0.8))), W / 2, H / 2 - 40, { size: 130, color: "#fff", stroke: "#2B2350" });
    if (phase === "done") text(g, "Temps écoulé !", W / 2, H / 2 - 40, { size: 64, color: "#fff", stroke: "#2B2350" });
  }

  function drawItem(g, it) {
    g.save();
    g.translate(it.x, it.y);
    const r = 24;
    switch (it.kind) {
      case "pomme": case "doree":
        g.fillStyle = it.kind === "doree" ? "#FFC83D" : "#EB4B4B";
        g.beginPath(); g.arc(-7, 2, r * 0.8, 0, Math.PI * 2); g.arc(7, 2, r * 0.8, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#6B4A2A"; g.fillRect(-2, -r, 4, 12);
        g.fillStyle = "#6CBF5A"; g.beginPath(); g.ellipse(9, -r + 4, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
        if (it.kind === "doree") { g.fillStyle = "#ffffffcc"; g.beginPath(); g.arc(-10, -4, 5, 0, Math.PI * 2); g.fill(); }
        break;
      case "poire":
        g.fillStyle = "#B7D65A"; g.beginPath(); g.arc(0, 8, r * 0.85, 0, Math.PI * 2); g.arc(0, -8, r * 0.55, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#6B4A2A"; g.fillRect(-2, -r - 2, 4, 10);
        break;
      case "fraise":
        g.fillStyle = "#EB4B6B"; g.beginPath(); g.moveTo(-r, -8); g.quadraticCurveTo(0, -18, r, -8); g.quadraticCurveTo(r * 0.6, r, 0, r + 4); g.quadraticCurveTo(-r * 0.6, r, -r, -8); g.fill();
        g.fillStyle = "#FFE7A3"; for (const [sx, sy] of [[-8, 0], [6, -2], [-2, 10], [8, 10], [-10, -8]]) { g.beginPath(); g.arc(sx, sy, 1.8, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#6CBF5A"; g.beginPath(); g.ellipse(0, -14, 14, 6, 0, 0, Math.PI * 2); g.fill();
        break;
      case "orange":
        g.fillStyle = "#FF9F3A"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#6CBF5A"; g.beginPath(); g.ellipse(6, -r + 2, 8, 4, -0.4, 0, Math.PI * 2); g.fill();
        break;
      case "bombe":
        g.fillStyle = "#3A3F66"; g.beginPath(); g.arc(0, 4, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#8C7E70"; g.lineWidth = 4; g.beginPath(); g.moveTo(8, -r + 4); g.quadraticCurveTo(14, -r - 8, 22, -r - 4); g.stroke();
        g.fillStyle = Math.floor(it.spin * 4) % 2 ? "#FFC83D" : "#FF6B3A"; g.beginPath(); g.arc(22, -r - 4, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff55"; g.beginPath(); g.arc(-8, -4, 6, 0, Math.PI * 2); g.fill();
        break;
      case "aimant":
        g.rotate(Math.sin(it.spin) * 0.3);
        g.strokeStyle = "#EB5757"; g.lineWidth = 12; g.lineCap = "butt"; g.beginPath(); g.arc(0, 0, 16, Math.PI, 0); g.stroke();
        g.fillStyle = "#C9C2D9"; g.fillRect(-22, 0, 12, 12); g.fillRect(10, 0, 12, 12);
        break;
      case "sablier":
        g.fillStyle = "#7FD0F2"; g.beginPath(); g.moveTo(-16, -20); g.lineTo(16, -20); g.lineTo(0, 0); g.lineTo(16, 20); g.lineTo(-16, 20); g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = "#8C5A2B"; g.fillRect(-20, -24, 40, 6); g.fillRect(-20, 18, 40, 6);
        break;
    }
    g.restore();
  }

  const loop = createLoop(dt => { update(dt); draw(); });
  return {
    start() { say(solo ? "Glisse ton panier pour attraper les fruits !" : "Chacun glisse son panier !"); loop.start(); },
    pause() { loop.stop(); fingers.clear(); keys.clear(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); fields.forEach(f => f.stage.destroy()); document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKey); }
  };
}

function demo() {
  const node = h(`<div class="pf-demo"><span class="pf-fruit a"></span><span class="pf-fruit b"></span><span class="pf-basket"></span></div>`);
  return { node, stop() {} };
}

export default {
  id: "panier-fruits",
  title: "Panier de fruits",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFE0CF", ink: "#A2421F" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true"><rect width="160" height="120" rx="16" fill="#FFE7C2"/><circle cx="60" cy="40" r="12" fill="#EB4B4B"/><circle cx="100" cy="62" r="11" fill="#FF9F3A"/><rect x="50" y="88" width="60" height="22" rx="8" fill="#B87A42"/></svg>`,
  rules: {
    text: session => session.count === 1
      ? "Glisse ton doigt pour bouger le panier et attraper les fruits. Pomme dorée : 3 points. Bombe : moins 2 ! Cinq fruits de suite et les points comptent double."
      : "Chacun glisse son panier dans son verger. Tout le monde reçoit les mêmes fruits ! Évite les bombes. Le plus de points gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
