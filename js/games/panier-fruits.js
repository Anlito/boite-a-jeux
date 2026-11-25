// Panier de fruits : glisser son panier pour attraper les fruits, éviter les pièges.
// Chaque joueur a son propre verger, avec exactement les mêmes fruits et les mêmes pièges au même moment.
//
// Pièges : bombe (−2), pomme pourrie (−1, elle ressemble à un fruit !), bogue de châtaigne (panier bloqué),
// guêpe qui traverse le verger en zigzag (−1 et panier bloqué).
// Bonus : pomme dorée (+3), aimant, sablier, série de 5 (points doublés).
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, text, createParticles, seatAt, artImage } from "../core/stage.js";
import { hasImage, imagePath } from "../core/art.js";

const W = 800, BASKET = 72, INK = "#3B2F5A";
// Images du lot 6 (null si absentes : on garde le dessin).
const picture = name => hasImage(`panier-fruits/${name}`) ? artImage(`<img src="${imagePath(`panier-fruits/${name}`)}">`) : null;
const ready = img => img && img.complete && img.naturalWidth;
const IMG = {
  fond: picture("fond-verger.jpg"), etourdi: picture("etoiles-etourdi.png"), guepe: picture("guepe.png"),
  pomme: picture("pomme.png"), poire: picture("poire.png"), fraise: picture("fraise.png"), orange: picture("orange.png"),
  prune: picture("prune.png"), doree: picture("pomme-doree.png"), pourrie: picture("pomme-pourrie.png"),
  bombe: picture("bombe.png"), bogue: picture("bogue.png"), aimant: picture("aimant.png"), sablier: picture("sablier.png")
};
const BASKETS = { Bleu: picture("panier-bleu.png"), Rouge: picture("panier-rouge.png"), Vert: picture("panier-vert.png"), Jaune: picture("panier-jaune.png") };
const ITEMS = {
  pomme: { points: 1 }, poire: { points: 1 }, fraise: { points: 1 }, orange: { points: 1 }, prune: { points: 1 },
  doree: { points: 3 }, aimant: { power: "aimant" }, sablier: { power: "sablier" },
  bombe: { points: -2, trap: true }, pourrie: { points: -1, trap: true }, bogue: { stun: 1.6, trap: true }
};
const FRUITS = ["pomme", "poire", "fraise", "orange", "prune"];
const ROBOT = { 1: { speed: 260, error: 80, fear: 0.35 }, 2: { speed: 380, error: 45, fear: 0.7 }, 3: { speed: 560, error: 15, fear: 0.95 } };

// Niveaux solo : durée, rythme (secondes entre deux objets au début et à la fin), chute, pièges permis et leur fréquence,
// guêpes, bonus, points pour 1/2/3 étoiles.
const LEVELS = [
  { time: 40, every: [1.1, 0.85], fall: [180, 240], traps: [], trapRate: 0, wasps: false, gold: 0.08, powers: false, stars: [15, 25, 35], goal: "Glisse ton panier pour attraper les fruits !" },
  { time: 40, every: [1.05, 0.8], fall: [190, 260], traps: ["bombe"], trapRate: 0.1, wasps: false, gold: 0.08, powers: false, stars: [16, 27, 37], goal: "Attention aux bombes : elles enlèvent 2 points !" },
  { time: 45, every: [1, 0.75], fall: [200, 270], traps: ["bombe", "pourrie"], trapRate: 0.14, wasps: false, gold: 0.1, powers: false, stars: [19, 31, 43], goal: "Les pommes pourries ressemblent à des fruits… mais elles enlèvent 1 point !" },
  { time: 45, every: [0.95, 0.72], fall: [210, 290], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.16, wasps: false, gold: 0.1, powers: true, stars: [21, 34, 47], goal: "La bogue de châtaigne pique et bloque ton panier !" },
  { time: 50, every: [0.9, 0.68], fall: [220, 310], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.17, wasps: true, gold: 0.1, powers: true, stars: [24, 38, 52], goal: "Des guêpes traversent le verger en zigzag. Esquive-les !" },
  { time: 50, every: [0.85, 0.64], fall: [230, 330], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.2, wasps: true, gold: 0.1, powers: true, stars: [26, 41, 56], goal: "Plus de pièges. Garde ta série pour doubler les points !" },
  { time: 55, every: [0.8, 0.6], fall: [240, 350], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.22, wasps: true, gold: 0.1, powers: true, stars: [30, 47, 64], goal: "Les fruits tombent plus vite !" },
  { time: 55, every: [0.75, 0.56], fall: [250, 370], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.24, wasps: true, gold: 0.1, powers: true, stars: [33, 51, 70], goal: "Une vraie pluie de fruits… et de pièges !" },
  { time: 60, every: [0.72, 0.52], fall: [260, 390], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.26, wasps: true, gold: 0.1, powers: true, stars: [37, 58, 80], goal: "Presque le niveau des champions !" },
  { time: 60, every: [0.68, 0.48], fall: [270, 410], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.28, wasps: true, gold: 0.1, powers: true, stars: [41, 64, 88], goal: "Le défi des champions : 60 secondes de folie !" }
];
const FREE = { time: 60, every: [0.95, 0.5], fall: [210, 390], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.22, wasps: true, gold: 0.1, powers: true, stars: [33, 52, 72] };
const MULTI = { time: 45, every: [0.95, 0.6], fall: [210, 340], traps: ["bombe", "pourrie", "bogue"], trapRate: 0.2, wasps: true, gold: 0.1, powers: true };

const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickOne = list => list[Math.floor(Math.random() * list.length)];

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const setup = solo ? (ctx.level || FREE) : MULTI;
  const people = ctx.seats;
  const n = people.length;
  // Hauteur du verger selon la forme de la zone de chaque joueur (la même pour tous : c'est équitable).
  const zoneW = window.innerWidth / (n > 2 ? 2 : 1), zoneH = window.innerHeight / (n > 1 ? 2 : 1);
  const H = Math.round(clamp(W * zoneH / zoneW, 380, 1800));
  const BASKET_Y = H - 110;
  const scale = H / 600;                                   // même temps de chute quelle que soit la hauteur

  const node = h(`<div class="pf td n${n}">${people.map((p, i) => `<section class="pf-zone pos-${i}" data-seat="${i}"></section>`).join("")}</div>`);
  root.append(node);
  const flipped = i => n > 1 && (i === 1 || i === 3);
  const fields = people.map((p, i) => {
    const zone = node.querySelector(`.pf-zone.pos-${i}`);
    const stage = createStage(zone, { width: W, height: H, background: ready(IMG.fond) || hasImage("panier-fruits/fond-verger.jpg") ? "#FEF6E9" : "#FCE3C4", flipped: flipped(i) });
    if (flipped(i)) stage.canvas.style.transform = "rotate(180deg)";
    return { seat: i, p, zone, stage, g: stage.ctx, particles: createParticles(), x: W / 2, target: W / 2, score: 0, streak: 0, items: [], wasps: [], magnet: 0, slow: 0, stun: 0, tilt: 0, flash: null, ai: { wait: 0 } };
  });

  let clock = 0, next = 0.8, waspTimer = 8, phase = "count", timer = 2.4, finished = false;
  // Décor tiré une fois pour toutes (le même pour tous les vergers).
  const flowers = Array.from({ length: 16 }, () => ({ x: between(10, W - 10), y: between(H - 46, H - 10), c: pickOne(["#FF9AA8", "#FFE07A", "#FFFFFF", "#B9A6F2"]) }));

  /* ---------- Fruits et pièges ---------- */

  function spawn() {
    const progress = clock / setup.time;
    const roll = Math.random();
    let kind;
    if (clock > 3 && setup.traps.length && roll < setup.trapRate) kind = pickOne(setup.traps);
    else if (roll < setup.trapRate + setup.gold) kind = "doree";
    else if (setup.powers && roll > 0.965) kind = Math.random() < 0.5 ? "aimant" : "sablier";
    else kind = pickOne(FRUITS);
    const x = between(50, W - 50);
    const fall = between(...setup.fall) * (0.9 + progress * 0.25) * scale;
    for (const f of fields) f.items.push({ kind, x, y: -30, fall, spin: Math.random() * 6 });
  }

  function spawnWasp() {
    const fromLeft = Math.random() < 0.5;
    const y = between(H * 0.25, H * 0.45);
    const vx = (fromLeft ? 1 : -1) * between(150, 210), drop = between(55, 85) * scale, t = Math.random() * 6;
    for (const f of fields) f.wasps.push({ x: fromLeft ? -40 : W + 40, y, vx, drop, t, hit: false });
  }

  /* ---------- Commandes ---------- */

  const fingers = new Map();
  const zoneOf = event => solo ? fields[0] : fields[seatAt(n, event.clientX, event.clientY, node.getBoundingClientRect())];
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
    const good = f.items.filter(it => !ITEMS[it.kind].trap && it.y < BASKET_Y && it.y > 0)
      .filter(it => Math.abs(it.x - f.x) / rules.speed < (BASKET_Y - it.y) / it.fall + 0.1)
      .sort((a, b) => b.y - a.y)[0];
    let aim = good ? good.x + between(-rules.error, rules.error) : f.x;
    const danger = [...f.items.filter(it => ITEMS[it.kind].trap && it.y > BASKET_Y - 170 && it.y < BASKET_Y), ...f.wasps.filter(w => w.y > BASKET_Y - 150)]
      .find(d => Math.abs(d.x - aim) < BASKET + 30);
    if (danger && Math.random() < rules.fear) aim = danger.x < W / 2 ? danger.x + BASKET + 70 : danger.x - BASKET - 70;
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
    if (setup.wasps) {
      waspTimer -= dt;
      if (waspTimer <= 0 && clock < setup.time - 3) { spawnWasp(); waspTimer = between(6, 9) - progress * 2; }
    }
    for (const f of fields) {
      f.magnet = Math.max(0, f.magnet - dt);
      f.slow = Math.max(0, f.slow - dt);
      f.stun = Math.max(0, f.stun - dt);
      let speed = 2400;
      if (f.p.kind === "robot") speed = think(f, dt);
      if (f.seat === 0 && keys.size) f.target = f.x + (keys.has("ArrowRight") - keys.has("ArrowLeft")) * 90;
      const before = f.x;
      if (f.stun <= 0) f.x = clamp(f.x + clamp(f.target - f.x, -speed * dt, speed * dt), BASKET, W - BASKET);
      f.tilt += ((f.x - before) / Math.max(dt, 0.001) / 2000 - f.tilt) * Math.min(1, dt * 10);   // le panier penche quand il file
      const half = BASKET * (1 + (f.p.boost || 0) * 0.2);
      const slowdown = f.slow > 0 ? 0.45 : 1;
      for (const it of f.items) {
        const was = it.y;
        it.y += it.fall * dt * slowdown;
        it.spin += dt * 2;
        if (f.magnet > 0 && !ITEMS[it.kind].trap && it.y > H * 0.2) it.x += clamp(f.x - it.x, -260 * dt, 260 * dt);
        if (was < BASKET_Y && it.y >= BASKET_Y && Math.abs(it.x - f.x) <= half + 10) catchItem(f, it);
        else if (was < BASKET_Y + 40 && it.y >= BASKET_Y + 40 && (ITEMS[it.kind].points || 0) > 0) f.streak = 0;
      }
      f.items = f.items.filter(it => !it.caught && it.y < H + 40);
      for (const w of f.wasps) {
        w.t += dt;
        w.x += w.vx * dt * slowdown;
        w.y += w.drop * dt * slowdown;
        const wy = w.y + Math.sin(w.t * 5) * 34;
        if (!w.hit && Math.abs(w.x - f.x) < half + 14 && Math.abs(wy - (BASKET_Y + 16)) < 34) {
          w.hit = true;
          f.score = Math.max(0, f.score - 1);
          f.streak = 0;
          f.stun = 0.9;
          f.flash = { text: "Aïe ! −1", color: "#C62F2F", time: 0.9 };
          f.particles.burst(f.x, BASKET_Y, "#FFC83D", { count: 12, speed: 220, size: 7, life: 0.5 });
          if (f.p.kind === "human") play("wrong");
        }
      }
      f.wasps = f.wasps.filter(w => w.x > -80 && w.x < W + 80 && w.y < H + 60);
      if (f.flash) { f.flash.time -= dt; if (f.flash.time <= 0) f.flash = null; }
    }
    if (clock >= setup.time) end();
  }

  function catchItem(f, it) {
    it.caught = true;
    const info = ITEMS[it.kind];
    const human = f.p.kind === "human";
    if (it.kind === "bombe" || it.kind === "pourrie") {
      f.score = Math.max(0, f.score + info.points);
      f.streak = 0;
      f.flash = { text: String(info.points).replace("-", "−"), color: "#C62F2F", time: 0.8 };
      f.particles.burst(it.x, BASKET_Y, it.kind === "bombe" ? "#FF626D" : "#8A9A4A", { count: 18, speed: 300, size: 9, life: 0.6 });
      if (human) play("wrong");
      return;
    }
    if (it.kind === "bogue") {
      f.stun = info.stun;
      f.streak = 0;
      f.flash = { text: "Ça pique !", color: "#8C5A2B", time: 1 };
      if (human) play("wrong");
      return;
    }
    if (info.power === "aimant") { f.magnet = 6; f.flash = { text: "Aimant !", color: "#7B61FF", time: 1 }; if (human) play("star"); return; }
    if (info.power === "sablier") { f.slow = 6; f.flash = { text: "Ralenti !", color: "#2F80ED", time: 1 }; if (human) play("star"); return; }
    f.streak++;
    const bonus = f.streak >= 5 ? 2 : 1;
    f.score += info.points * bonus;
    f.flash = { text: `+${info.points * bonus}`, color: bonus > 1 ? "#E59A00" : "#2F7A2A", time: 0.6 };
    f.particles.burst(it.x, BASKET_Y, it.kind === "doree" ? "#FFE161" : "#C6FF9B", { count: 10, speed: 220, size: 7, life: 0.5 });
    if (human || solo) play(it.kind === "doree" ? "star" : "pop");
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

  /* ---------- Dessin : style des illustrations (formes rondes, contour foncé) ---------- */

  function outline(g, width = 4) { g.lineWidth = width; g.strokeStyle = INK; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  function blob(g, x, y, rx, ry, color, line = 4) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = color; g.fill(); if (line) outline(g, line); }

  function drawScene(g) {
    if (ready(IMG.fond)) {
      const img = IMG.fond, k = W / img.naturalWidth;
      const topSrc = img.naturalHeight * 0.23, bottomSrc = img.naturalHeight * 0.2;
      // Si le verger est bas, on rogne le haut des branches et le bas de l'herbe.
      const fit = Math.min(1, (H * 0.5) / ((topSrc + bottomSrc) * k));
      g.fillStyle = "#FEF6E9"; g.fillRect(0, 0, W, H);
      const th = topSrc * fit, bh = bottomSrc * fit;
      g.drawImage(img, 0, topSrc - th, img.naturalWidth, th, 0, 0, W, th * k);
      g.drawImage(img, 0, img.naturalHeight - bottomSrc, img.naturalWidth, bh, 0, H - bh * k, W, bh * k);
      return;
    }
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#CDEBFF"); sky.addColorStop(0.55, "#FFF1D6"); sky.addColorStop(1, "#FCE3C4");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    blob(g, 680, Math.min(100, H * 0.14), 42, 42, "#FFE7A3", 0);
    for (const [cx, cy, s] of [[140, H * 0.12, 1], [470, H * 0.08, 0.8]]) {
      g.fillStyle = "#ffffffd9";
      for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 22], [52, 2, 20]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
    }
    // Collines
    g.fillStyle = "#BFDC9A";
    g.beginPath(); g.moveTo(0, H * 0.62); g.quadraticCurveTo(220, H * 0.48, 460, H * 0.6); g.quadraticCurveTo(640, H * 0.7, W, H * 0.56); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    // Arbres fruitiers (contour foncé, comme les vignettes)
    for (let i = 0; i < 4; i++) {
      const x = 90 + i * 210, y = H * 0.36 + (i % 2) * 34;
      g.beginPath(); g.roundRect(x - 12, y, 24, H - y, 8); g.fillStyle = "#A0714B"; g.fill(); outline(g, 3);
      blob(g, x, y - 6, 92, 70, "#7DBB6A", 4);
      blob(g, x - 34, y - 26, 44, 36, "#93CF7C", 0);
      for (const [dx, dy] of [[-40, 4], [24, -22], [46, 18], [-6, 30]]) blob(g, x + dx, y + dy, 8, 8, i % 2 ? "#FF9F3A" : "#EB4B4B", 2);
    }
    // Barrière et herbe
    g.fillStyle = "#F3D6A4";
    for (let x = 10; x < W; x += 58) { g.beginPath(); g.roundRect(x, H - 92, 18, 52, [9, 9, 2, 2]); g.fill(); outline(g, 2.5); }
    g.beginPath(); g.roundRect(0, H - 78, W, 12, 6); g.fillStyle = "#F3D6A4"; g.fill(); outline(g, 2.5);
    g.fillStyle = "#8FC46E"; g.fillRect(0, H - 52, W, 52);
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H - 52); g.lineTo(W, H - 52); g.stroke();
    for (const fl of flowers) blob(g, fl.x, fl.y, 5, 5, fl.c, 1.5);
  }

  function drawItem(g, it) {
    const img = IMG[it.kind];
    if (ready(img)) {
      g.save();
      g.translate(it.x, it.y);
      if (it.kind === "bogue") g.rotate(it.spin);
      if (it.kind === "aimant") g.rotate(Math.sin(it.spin) * 0.3);
      const size = it.kind === "doree" ? 136 : 120;
      g.drawImage(img, -size / 2, -size / 2, size, size);
      g.restore();
      return;
    }
    g.save();
    g.translate(it.x, it.y);
    const r = 24;
    switch (it.kind) {
      case "pomme": case "doree": case "pourrie": {
        const body = it.kind === "doree" ? "#FFC83D" : it.kind === "pourrie" ? "#9AA25A" : "#EB4B4B";
        g.beginPath(); g.arc(-7, 3, r * 0.8, 0, Math.PI * 2); g.arc(7, 3, r * 0.8, 0, Math.PI * 2);
        g.fillStyle = body; g.fill(); outline(g, 3.5);
        g.beginPath(); g.moveTo(0, -r + 6); g.lineTo(2, -r - 6); outline(g, 4);
        g.beginPath(); g.ellipse(10, -r + 2, 9, 5, -0.5, 0, Math.PI * 2); g.fillStyle = "#6CBF5A"; g.fill(); outline(g, 2.5);
        if (it.kind === "pourrie") {
          blob(g, -8, 6, 6, 4, "#6E6B3A", 0); blob(g, 8, -2, 4, 3, "#6E6B3A", 0);
          for (let k = 0; k < 2; k++) { const a = it.spin * 3 + k * Math.PI; blob(g, Math.cos(a) * 30, -18 + Math.sin(a) * 10, 3, 3, INK, 0); }   // mouches
        } else blob(g, -10, -4, 5, 4, "#ffffffaa", 0);
        if (it.kind === "doree") { g.fillStyle = "#fff"; for (const a of [0, 2.1, 4.2]) { g.beginPath(); g.arc(Math.cos(a + it.spin) * 34, Math.sin(a + it.spin) * 34, 3, 0, Math.PI * 2); g.fill(); } }
        break;
      }
      case "poire":
        g.beginPath(); g.arc(0, 8, r * 0.85, 0, Math.PI * 2); g.arc(0, -8, r * 0.55, 0, Math.PI * 2);
        g.fillStyle = "#C2DB5E"; g.fill(); outline(g, 3.5);
        g.beginPath(); g.moveTo(0, -r + 2); g.lineTo(3, -r - 8); outline(g, 4);
        blob(g, -8, 2, 5, 4, "#ffffffaa", 0);
        break;
      case "fraise":
        g.beginPath(); g.moveTo(-r, -8); g.quadraticCurveTo(0, -18, r, -8); g.quadraticCurveTo(r * 0.6, r, 0, r + 4); g.quadraticCurveTo(-r * 0.6, r, -r, -8);
        g.fillStyle = "#EB4B6B"; g.fill(); outline(g, 3.5);
        g.fillStyle = "#FFE7A3"; for (const [sx, sy] of [[-8, 0], [6, -2], [-2, 10], [8, 10], [-10, -8]]) { g.beginPath(); g.arc(sx, sy, 2, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.ellipse(0, -14, 15, 6, 0, 0, Math.PI * 2); g.fillStyle = "#6CBF5A"; g.fill(); outline(g, 2.5);
        break;
      case "orange":
        blob(g, 0, 0, r, r, "#FF9F3A", 3.5);
        g.beginPath(); g.ellipse(7, -r + 1, 8, 4, -0.4, 0, Math.PI * 2); g.fillStyle = "#6CBF5A"; g.fill(); outline(g, 2.5);
        blob(g, -8, -6, 5, 4, "#ffffffaa", 0);
        break;
      case "prune":
        blob(g, 0, 2, r * 0.8, r, "#8C6BD8", 3.5);
        g.beginPath(); g.moveTo(0, -r + 4); g.quadraticCurveTo(3, 0, 0, r - 2); g.strokeStyle = "#6A4FB8"; g.lineWidth = 2; g.stroke();
        blob(g, -6, -6, 4, 6, "#ffffff99", 0);
        break;
      case "bombe":
        blob(g, 0, 4, r, r, "#3A3F66", 3.5);
        g.beginPath(); g.moveTo(8, -r + 4); g.quadraticCurveTo(14, -r - 8, 22, -r - 4); g.strokeStyle = "#8C7E70"; g.lineWidth = 4; g.stroke();
        blob(g, 22, -r - 4, 5, 5, Math.floor(it.spin * 4) % 2 ? "#FFC83D" : "#FF6B3A", 0);
        blob(g, -8, -4, 6, 5, "#ffffff55", 0);
        break;
      case "bogue":
        g.rotate(it.spin);
        g.strokeStyle = INK; g.lineWidth = 3;
        for (let k = 0; k < 14; k++) { const a = k * Math.PI / 7; g.beginPath(); g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); g.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); g.stroke(); }
        blob(g, 0, 0, 20, 20, "#A6C25A", 3.5);
        blob(g, 0, 2, 9, 8, "#8C5A2B", 2);
        break;
      case "aimant":
        g.rotate(Math.sin(it.spin) * 0.3);
        g.beginPath(); g.arc(0, 0, 17, Math.PI, 0); g.strokeStyle = INK; g.lineWidth = 17; g.stroke();
        g.beginPath(); g.arc(0, 0, 17, Math.PI, 0); g.strokeStyle = "#EB5757"; g.lineWidth = 11; g.stroke();
        g.beginPath(); g.roundRect(-23, 0, 13, 13, 3); g.roundRect(10, 0, 13, 13, 3); g.fillStyle = "#E3E0EE"; g.fill(); outline(g, 3);
        break;
      case "sablier":
        g.beginPath(); g.moveTo(-16, -20); g.lineTo(16, -20); g.lineTo(0, 0); g.lineTo(16, 20); g.lineTo(-16, 20); g.lineTo(0, 0); g.closePath();
        g.fillStyle = "#BFE8FF"; g.fill(); outline(g, 3);
        g.beginPath(); g.moveTo(-8, 16); g.lineTo(8, 16); g.lineTo(0, 6); g.closePath(); g.fillStyle = "#F2C94C"; g.fill();
        g.beginPath(); g.roundRect(-21, -25, 42, 7, 3); g.roundRect(-21, 18, 42, 7, 3); g.fillStyle = "#A0714B"; g.fill(); outline(g, 2.5);
        break;
    }
    g.restore();
  }

  function drawWasp(g, w) {
    const y = w.y + Math.sin(w.t * 5) * 34;
    g.save();
    g.translate(w.x, y);
    if (w.vx < 0) g.scale(-1, 1);
    if (ready(IMG.guepe)) {
      g.rotate(Math.sin(w.t * 12) * 0.08);
      g.drawImage(IMG.guepe, -70, -70, 140, 140);
      g.restore();
      return;
    }
    const flap = Math.sin(w.t * 40) * 0.4;
    g.beginPath(); g.ellipse(-4, -16, 10, 16, -0.6 + flap, 0, Math.PI * 2); g.ellipse(8, -16, 10, 16, 0.4 - flap, 0, Math.PI * 2);
    g.fillStyle = "#ffffffcc"; g.fill(); outline(g, 2);
    blob(g, 0, 0, 22, 14, "#FFC83D", 3.5);
    g.fillStyle = INK; g.fillRect(-8, -12, 5, 24); g.fillRect(4, -12, 5, 24);
    g.beginPath(); g.moveTo(-22, 0); g.lineTo(-32, 0); outline(g, 3);
    blob(g, 18, -3, 3, 3, INK, 0);
    g.restore();
  }

  function drawBasket(f) {
    const { g } = f;
    const half = BASKET * (1 + (f.p.boost || 0) * 0.2);
    g.save();
    g.translate(f.x + (f.stun > 0 ? Math.sin(clock * 50) * 4 : 0), BASKET_Y);
    g.rotate(clamp(f.tilt, -0.18, 0.18));
    if (f.magnet > 0) { g.strokeStyle = "#7B61FF66"; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 110 + Math.sin(clock * 10) * 6, Math.PI, 0); g.stroke(); }
    g.fillStyle = "#3B2F5A22"; g.beginPath(); g.ellipse(0, 62, half, 10, 0, 0, Math.PI * 2); g.fill();
    const basket = BASKETS[f.p.name];
    if (ready(basket)) {
      // Panier du lot 6 : le bord visible (x 69 à 429, haut à 171 sur 512) couvre la zone d'attrape.
      const sc = (half * 2.2) / 360;   // pixels affichés par unité de l'image d'origine (512)
      g.drawImage(basket, -249 * sc, -6 - 171 * sc, 512 * sc, 512 * sc);
      if (f.stun > 0) {
        if (ready(IMG.etourdi)) { g.save(); g.translate(0, -42); g.rotate(Math.sin(clock * 8) * 0.25); g.drawImage(IMG.etourdi, -70, -70, 140, 140); g.restore(); }
        else for (let k2 = 0; k2 < 3; k2++) { const a = clock * 6 + k2 * 2.1; text(g, "★", Math.cos(a) * 40, -28 + Math.sin(a) * 8, { size: 22, color: "#FFC83D" }); }
      }
      g.restore();
      return;
    }
    // Corps tressé
    g.beginPath(); g.moveTo(-half, 4); g.lineTo(half, 4); g.lineTo(half * 0.82, 56); g.quadraticCurveTo(0, 64, -half * 0.82, 56); g.closePath();
    g.fillStyle = "#D9A15E"; g.fill();
    g.save(); g.clip();
    g.strokeStyle = "#B7793F"; g.lineWidth = 4;
    for (let k = -half; k < half; k += 16) { g.beginPath(); g.moveTo(k, 4); g.lineTo(k + 10, 60); g.stroke(); }
    g.strokeStyle = "#E8B878"; g.lineWidth = 3;
    for (let yy = 18; yy < 60; yy += 14) { g.beginPath(); g.moveTo(-half, yy); g.lineTo(half, yy); g.stroke(); }
    g.restore();
    g.beginPath(); g.moveTo(-half, 4); g.lineTo(half, 4); g.lineTo(half * 0.82, 56); g.quadraticCurveTo(0, 64, -half * 0.82, 56); g.closePath(); outline(g, 4);
    // Bord à la couleur du joueur
    g.beginPath(); g.roundRect(-half - 6, -6, half * 2 + 12, 16, 8); g.fillStyle = f.p.color; g.fill(); outline(g, 4);
    if (f.stun > 0) for (let k = 0; k < 3; k++) { const a = clock * 6 + k * 2.1; text(g, "★", Math.cos(a) * 40, -28 + Math.sin(a) * 8, { size: 22, color: "#FFC83D" }); }
    g.restore();
  }

  function drawField(f) {
    const { g, stage } = f;
    stage.begin();
    drawScene(g);
    for (const it of f.items) drawItem(g, it);
    for (const w of f.wasps) drawWasp(g, w);
    drawBasket(f);
    f.particles.draw(g);
    // Repères : score, série, temps
    g.beginPath(); g.roundRect(96, 14, 190, 58, 29); g.fillStyle = "#ffffffee"; g.fill(); outline(g, 3);
    blob(g, 126, 43, 14, 14, f.p.color, 2.5);
    text(g, `${f.score}`, 180, 44, { size: 36, color: f.p.deep });
    if (f.streak >= 5) text(g, "×2", 248, 44, { size: 28, color: "#E59A00" });
    g.beginPath(); g.roundRect(W - 140, 14, 124, 58, 29); g.fillStyle = "#ffffffee"; g.fill(); outline(g, 3);
    const left = Math.max(0, Math.ceil(setup.time - clock));
    text(g, `${left} s`, W - 78, 44, { size: 32, color: left <= 5 ? "#C62F2F" : INK });
    if (f.flash) text(g, f.flash.text, f.x, BASKET_Y - 46, { size: 38, color: f.flash.color, stroke: "#fff" });
    if (phase === "count") text(g, String(Math.max(1, Math.ceil(timer / 0.8))), W / 2, H / 2 - 40, { size: 130, color: "#fff", stroke: INK });
    if (phase === "done") text(g, "Temps écoulé !", W / 2, H / 2 - 40, { size: 64, color: "#fff", stroke: INK });
  }

  const loop = createLoop(dt => { update(dt); fields.forEach(drawField); });
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
      ? "Glisse ton doigt pour bouger le panier. Attrape les fruits, mais attention aux pièges : bombe, pomme pourrie, bogue qui pique et guêpes ! Cinq fruits de suite et les points comptent double."
      : "Chacun glisse son panier dans son verger. Tout le monde reçoit les mêmes fruits et les mêmes pièges ! Le plus de points gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
