// Course des grenouilles : sauter par-dessus les obstacles, ramasser des pièces.
// Un couloir par joueur, le même parcours pour tous. Touche ton couloir pour sauter, une deuxième fois en l'air pour un double saut.
import { SEATS, robotArt, icon } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, text, createParticles } from "../core/stage.js";

const W = 1600, H = 900;
const FROG_X = 230, GROUND = 250, LANE = 300;     // repère d'un couloir : 300 unités de haut, sol à 250
const JUMP = 760, DOUBLE = 640, GRAVITY = 1750;
const HEARTS = 3;
// Obstacles. type : "sol" (sauter par-dessus), "haut" (double saut obligatoire),
// "abeille" (en l'air entre y0 et y1 : haute = rester au sol, basse = sauter), "mare" (un trou d'eau à franchir en l'air).
const KINDS = {
  puddle: { type: "sol", w: 74, h: 10 }, snail: { type: "sol", w: 50, h: 32 }, mushrooms: { type: "sol", w: 46, h: 46 },
  boot: { type: "sol", w: 38, h: 48 }, duck: { type: "sol", w: 58, h: 38 }, hedgehog: { type: "sol", w: 56, h: 40 },
  log: { type: "haut", w: 46, h: 178 },
  beeHigh: { type: "abeille", w: 44, y0: 62, y1: 112 },
  beeLow: { type: "abeille", w: 44, y0: 22, y1: 64 },
  pond: { type: "mare", w: 150 }, bigPond: { type: "mare", w: 250 }
};
const GROUND_KINDS = ["puddle", "snail", "mushrooms", "boot", "duck", "hedgehog"];
const ALL = [...GROUND_KINDS, "log", "beeHigh", "beeLow", "pond", "bigPond"];
const ROBOT = { 1: { early: [0.06, 0.34], miss: 0.2 }, 2: { early: [0.12, 0.24], miss: 0.08 }, 3: { early: [0.15, 0.2], miss: 0.02 } };

// Niveaux solo : distance de la ligne d'arrivée (en mètres), vitesses, obstacles, paires serrées (double saut).
const LEVELS = [
  { meters: 300, start: 340, top: 440, kinds: ["puddle", "snail", "mushrooms", "hedgehog"], pairs: false, goal: "Touche l'écran pour sauter par-dessus les obstacles !" },
  { meters: 350, start: 360, top: 480, kinds: [...GROUND_KINDS, "pond"], pairs: false, goal: "Des mares ! Saute pour ne pas tomber dans l'eau." },
  { meters: 400, start: 370, top: 500, kinds: [...GROUND_KINDS, "pond", "beeHigh"], pairs: false, goal: "Les abeilles volent haut : ne saute pas quand elles passent !" },
  { meters: 450, start: 390, top: 540, kinds: [...GROUND_KINDS, "pond", "beeHigh", "log"], pairs: false, goal: "Un tronc géant : touche deux fois pour un double saut !" },
  { meters: 500, start: 410, top: 580, kinds: ALL.filter(k => k !== "bigPond"), pairs: true, goal: "Abeilles hautes, abeilles basses : regarde bien avant de sauter !" },
  { meters: 600, start: 430, top: 620, kinds: ALL, pairs: true, goal: "Les grandes mares demandent un double saut !" },
  { meters: 700, start: 450, top: 660, kinds: ALL, pairs: true, goal: "Tout arrive vite. Garde tes trois cœurs !" },
  { meters: 800, start: 470, top: 700, kinds: ALL, pairs: true, goal: "Une longue course à toute vitesse !" },
  { meters: 900, start: 490, top: 740, kinds: ALL, pairs: true, goal: "Presque le niveau des champions !" },
  { meters: 1000, start: 510, top: 780, kinds: ALL, pairs: true, goal: "Le défi des champions : 1000 mètres à fond !" }
];
const FREE = { meters: null, start: 380, top: 780, kinds: ALL, pairs: true };
const MULTI = { meters: null, start: 380, top: 760, kinds: ALL, pairs: true };
const ACCEL = 9;

const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const THEMES = [
  { sky: "#BFEAD3", far: "#86BF8F", near: "#4B8E6F", earth: "#6B5039", grass: "#A6D96A" },
  { sky: "#F9D9A8", far: "#C9A17C", near: "#8A955F", earth: "#6E4E42", grass: "#D6C56B" },
  { sky: "#AFC2FF", far: "#6F80B3", near: "#466E85", earth: "#3E4357", grass: "#78C2A0" }
];

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const setup = solo ? (ctx.level || FREE) : MULTI;
  const people = solo ? [ctx.seats[0]] : ctx.seats;
  const lanes = people.length;
  const laneH = H / lanes;
  const s = Math.min(2.4, laneH / LANE);                 // échelle d'un couloir
  const view = W / s;                                    // largeur visible, en unités
  const stage = createStage(root, { width: W, height: H, background: "#BFEAD3" });
  const g = stage.ctx;
  const particles = createParticles();

  const runners = people.map((p, i) => ({
    seat: i, p, lane: i, y: 0, vy: 0, doubled: false, hearts: HEARTS, hit: 0, coins: 0, out: false, outAt: 0,
    image: artImage(p.art), ai: { plan: null }
  }));
  const course = [], coins = [];
  let distance = 0, speed = setup.start, lastRight = 900, phase = "count", timer = 2.4, eliminated = [];
  const finishAt = setup.meters ? setup.meters * 10 : null;

  function fill() {
    while (lastRight < distance + view + 400) {
      const kind = pickOne(setup.kinds);
      const gap = speed * between(0.95, 1.35) + (KINDS[kind].type === "mare" ? speed * 0.25 : 0);
      let at = lastRight + gap;
      if (finishAt && at > finishAt - 200) { lastRight = Infinity; return; }
      course.push({ kind, at, ...KINDS[kind], passed: new Set() });
      lastRight = at + KINDS[kind].w;
      // Paire serrée : un deuxième obstacle juste derrière (il faut un double saut ou un saut long).
      if (setup.pairs && KINDS[kind].type === "sol" && Math.random() < 0.25) {
        const second = pickOne(["snail", "puddle", "mushrooms"]);
        at = lastRight + speed * 0.32;
        course.push({ kind: second, at, ...KINDS[second], passed: new Set() });
        lastRight = at + KINDS[second].w;
      }
      // Des pièces en arc au-dessus de certains obstacles.
      if (Math.random() < 0.55 && KINDS[kind].type !== "abeille") {
        const mid = at + KINDS[kind].w / 2 - (KINDS[kind].type === "mare" ? 0 : KINDS[kind].w);
        for (let k = -1; k <= 1; k++) coins.push({ x: mid + k * 42, height: 120 + (k === 0 ? 40 : 0), taken: new Set() });
      }
    }
  }
  fill();

  /* ---------- Sauts ---------- */

  function jump(r) {
    if (phase !== "run" || r.out) return;
    if (r.y === 0) { r.vy = JUMP; r.doubled = false; play("pop"); }
    else if (!r.doubled) { r.vy = DOUBLE; r.doubled = true; play("tap"); particles.burst(FROG_X * s, laneTop(r) + (GROUND - r.y) * s, "#ffffffcc", { count: 6, speed: 120, size: 6, life: 0.3 }); }
  }
  const laneTop = r => H - (r.lane + 1) * laneH;
  const laneAt = y => Math.min(lanes - 1, Math.max(0, Math.floor((H - y) / laneH)));

  const onDown = event => {
    const point = stage.toWorld(event.clientX, event.clientY);
    const r = solo ? runners[0] : runners[laneAt(point.y)];
    if (!r || r.p.kind !== "human") return;
    event.preventDefault();
    jump(r);
  };
  root.addEventListener("pointerdown", onDown);
  const onKey = event => {
    const index = { " ": 0, Enter: 1 }[event.key];
    if (index === undefined || event.repeat || !runners[index] || runners[index].p.kind !== "human") return;
    event.preventDefault();
    jump(runners[index]);
  };
  document.addEventListener("keydown", onKey);

  /* ---------- Simulation ---------- */

  function think(r) {
    const rules = ROBOT[r.p.level];
    const next = course.find(o => o.at + o.w > distance + FROG_X - 20 && !o.passed.has(r));
    if (!next) return;
    const info = KINDS[next.kind];
    const gapTime = (next.at - (distance + FROG_X + 24)) / speed;
    if (!r.ai.plan || r.ai.plan.obstacle !== next) r.ai.plan = { obstacle: next, at: between(...rules.early), missed: Math.random() < rules.miss };
    const plan = r.ai.plan;
    if (info.type === "abeille" && info.y0 > 40) {
      // Abeille haute : le bon réflexe est de rester au sol (un robot distrait saute quand même).
      if (plan.missed && r.y === 0 && gapTime <= plan.at && gapTime > 0) jump(r);
      return;
    }
    const early = info.type === "mare" ? plan.at * 0.6 : plan.at;
    if (!plan.missed && r.y === 0 && gapTime <= early && gapTime > -0.05) jump(r);
    // Tronc ou grande mare : double saut au sommet du premier saut.
    if (!plan.missed && r.y > 0 && !r.doubled && r.vy < 80 && (info.type === "haut" || (info.type === "mare" && next.w > speed * 0.62))) jump(r);
    if (info.type !== "sol") return;
    // Paire serrée : double saut quand le deuxième obstacle arrive.
    const after = course[course.indexOf(next) + 1];
    if (after && r.y > 0 && !r.doubled && after.at - (next.at + next.w) < speed * 0.4) {
      const t2 = (after.at - (distance + FROG_X + 24)) / speed;
      if (t2 < 0.12 && !r.ai.plan.missed) jump(r);
    }
  }

  // La grenouille (de r.y à r.y + 34 en hauteur) touche-t-elle l'obstacle ?
  function touches(r, o, left, right) {
    const info = KINDS[o.kind];
    if (info.type === "abeille") return r.y + 34 > info.y0 && r.y < info.y1;
    if (info.type === "mare") {
      const middle = distance + FROG_X;
      return middle > o.at + 10 && middle < o.at + o.w - 10 && r.y <= 0;   // au sol au-dessus de l'eau : plouf
    }
    return r.y < o.h + 4;
  }

  function update(dt) {
    particles.update(dt);
    if (phase === "count") {
      timer -= dt;
      if (timer <= 0) { phase = "run"; play("go"); }
      return;
    }
    if (phase === "done") return;
    speed = Math.min(setup.top, speed + ACCEL * dt);
    distance += speed * dt;
    fill();
    while (course.length && course[0].at + course[0].w < distance - 200) course.shift();
    while (coins.length && coins[0].x < distance - 200) coins.shift();
    for (const r of runners) {
      if (r.out) continue;
      if (r.p.kind === "robot") think(r);
      r.hit = Math.max(0, r.hit - dt);
      if (r.y > 0 || r.vy > 0) {
        r.vy -= GRAVITY * dt;
        r.y = Math.max(0, r.y + r.vy * dt);
        if (r.y === 0) r.vy = 0;
      }
      const left = distance + FROG_X - 20, right = distance + FROG_X + 20;
      for (const o of course) {
        if (o.passed.has(r) || o.at > right || o.at + o.w < left) continue;
        if (r.hit <= 0 && touches(r, o, left, right)) {
          o.passed.add(r);
          r.hearts--;
          r.hit = 1.2;
          play("wrong");
          particles.burst(FROG_X * s, laneTop(r) + GROUND * s, r.p.color, { count: 12, speed: 220, size: 7, life: 0.5 });
          if (r.hearts <= 0) { r.out = true; r.outAt = distance; eliminated.push(r); }
        }
      }
      for (const c of coins) {
        if (c.taken.has(r) || Math.abs(c.x - (distance + FROG_X)) > 30 || Math.abs(c.height - r.y - 20) > 45) continue;
        c.taken.add(r);
        r.coins++;
        play("star");
      }
    }
    const alive = runners.filter(r => !r.out);
    if (finishAt && distance >= finishAt) return end(true);
    if (solo ? alive.length === 0 : (alive.length <= 1 || !alive.some(r => r.p.kind === "human"))) end(false);
  }

  function end(arrived) {
    phase = "done";
    sayEnd(arrived);
    setTimeout(() => {
      const meters = Math.floor(distance / 10);
      if (solo) {
        const me = runners[0];
        let stars;
        if (finishAt) stars = arrived ? me.hearts : 0;
        else stars = meters >= 1000 ? 3 : meters >= 600 ? 2 : meters >= 300 ? 1 : 0;
        ctx.finish({
          solo: {
            stars, value: meters, lowerIsBetter: false,
            format: v => `${v} m`,
            label: finishAt
              ? (arrived ? `Arrivée avec ${me.hearts} cœur${me.hearts > 1 ? "s" : ""} et ${me.coins} pièce${me.coins > 1 ? "s" : ""} ramassée${me.coins > 1 ? "s" : ""}` : `${meters} m sur ${setup.meters}`)
              : `${meters} m parcourus · ${me.coins} pièce${me.coins > 1 ? "s" : ""} ramassée${me.coins > 1 ? "s" : ""}`,
            speech: arrived ? "Tu as franchi la ligne d'arrivée !" : `Tu as parcouru ${meters} mètres !`,
            next: stars === 3 ? "" : finishAt ? (arrived ? `${stars + 1} étoiles : arriver avec ${stars + 1} cœurs` : "1 étoile : atteindre le drapeau") : stars === 2 ? "3 étoiles : 1000 m" : stars === 1 ? "2 étoiles : 600 m" : "1 étoile : 300 m"
          }
        });
        return;
      }
      ctx.finish({
        ranking: runners.map(r => ({
          seat: r.seat,
          score: r.out ? eliminated.indexOf(r) + 1 : 100 + r.hearts * 10 + r.coins,
          label: r.out ? `${Math.floor(r.outAt / 10)} m` : `${r.coins} pièce${r.coins > 1 ? "s" : ""}`
        }))
      });
    }, 1300);
  }
  function sayEnd(arrived) {
    if (arrived) { play("win"); return; }
    play("trap");
  }

  /* ---------- Dessin ---------- */

  function draw() {
    stage.begin();
    const theme = THEMES[Math.min(2, Math.floor(distance / 3000))];
    for (const r of [...runners].reverse()) drawLane(r, theme);
    g.fillStyle = "#183C40";
    for (let i = 1; i < lanes; i++) g.fillRect(0, H - i * laneH - 3, W, 6);
    particles.draw(g);
    if (phase === "count") text(g, String(Math.max(1, Math.ceil(timer / 0.8))), W / 2, H / 2, { size: 150, color: "#fff", stroke: "#2B2350" });
  }

  function drawLane(r, theme) {
    const top = laneTop(r);
    g.save();
    g.beginPath(); g.rect(0, top, W, laneH); g.clip();
    g.translate(0, top);
    g.scale(s, s);
    g.fillStyle = theme.sky; g.fillRect(0, 0, view, LANE);
    hills(GROUND - 120, distance * 0.15, theme.far, 60);
    hills(GROUND - 60, distance * 0.4, theme.near, 34);
    g.fillStyle = theme.earth; g.fillRect(0, GROUND, view, LANE - GROUND);
    g.fillStyle = theme.grass; g.fillRect(0, GROUND - 4, view, 12);
    // Mares : on creuse le sol.
    for (const o of course) {
      if (KINDS[o.kind].type !== "mare") continue;
      const x = o.at - distance;
      if (x + o.w < -20 || x > view) continue;
      g.fillStyle = "#2E7FA3"; g.fillRect(x, GROUND - 4, o.w, LANE - GROUND + 4);
      g.fillStyle = "#78D7DE"; g.fillRect(x, GROUND + 6, o.w, 10);
      g.fillStyle = "#7CC86B"; g.beginPath(); g.ellipse(x + o.w * 0.5, GROUND + 10, 16, 5, 0, 0, Math.PI * 2); g.fill();
    }
    // Ligne d'arrivée
    if (finishAt) {
      const fx = finishAt - distance + FROG_X;
      if (fx < view + 40) {
        for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? "#fff" : "#2B2350"; g.fillRect(fx, GROUND - 200 + k * 20, 16, 20); }
        g.fillStyle = "#EB5757"; g.beginPath(); g.moveTo(fx + 16, GROUND - 200); g.lineTo(fx + 70, GROUND - 180); g.lineTo(fx + 16, GROUND - 160); g.fill();
      }
    }
    for (const o of course) {
      const x = o.at - distance;
      if (x + o.w < -20 || x > view) continue;
      drawObstacle(o, x);
    }
    for (const c of coins) {
      if (c.taken.has(r)) continue;
      const x = c.x - distance;
      if (x < -20 || x > view) continue;
      g.fillStyle = "#FFC83D"; g.beginPath(); g.arc(x, GROUND - c.height, 13, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#E59A00"; g.lineWidth = 3; g.stroke();
    }
    // Grenouille
    g.fillStyle = "#12302B44";
    g.beginPath(); g.ellipse(FROG_X, GROUND + 3, 24 - r.y * 0.05, 6, 0, 0, Math.PI * 2); g.fill();
    if (!r.out && (r.hit <= 0 || Math.floor(r.hit * 14) % 2 === 0)) drawFrog(FROG_X, GROUND - 20 - r.y, r);
    if (r.out) text(g, "Plouf !", FROG_X, GROUND - 60, { size: 36, color: "#fff", stroke: "#2B2350" });
    g.restore();
    // Repères du couloir (pas à l'échelle)
    const bar = Math.min(48, laneH * 0.22);
    g.fillStyle = "#ffffffe0";
    g.beginPath(); g.roundRect(14, top + 10, 300, bar, bar / 2); g.fill();
    if (r.image.complete && r.image.naturalWidth) g.drawImage(r.image, 20, top + 12, bar - 4, bar - 4);
    text(g, "♥".repeat(Math.max(0, r.hearts)) + "♡".repeat(HEARTS - Math.max(0, r.hearts)), 20 + bar + 50, top + 10 + bar / 2, { size: bar * 0.62, color: "#EB5757" });
    text(g, `● ${r.coins}`, 20 + bar + 150, top + 10 + bar / 2, { size: bar * 0.5, color: "#B47A00", align: "left" });
    g.fillStyle = "#ffffffe0";
    g.beginPath(); g.roundRect(W - 190, top + 10, 176, bar, bar / 2); g.fill();
    text(g, finishAt ? `${Math.floor(distance / 10)} / ${setup.meters} m` : `${Math.floor(distance / 10)} m`, W - 102, top + 10 + bar / 2, { size: bar * 0.5 });
  }

  function hills(y, scroll, color, scale) {
    g.fillStyle = color;
    const span = scale * 3;
    for (let i = -1; i < view / span + 2; i++) {
      const index = i + Math.floor(scroll / span);
      const x = i * span - scroll % span;
      const off = Math.sin(index * 7.93) * scale * 0.34;
      g.beginPath();
      g.moveTo(x - span * 0.62, y + scale * 3);
      g.quadraticCurveTo(x - span * 0.57, y - scale * 0.35 + off, x, y - scale * 0.48 + off);
      g.quadraticCurveTo(x + span * 0.57, y - scale * 0.35 + off, x + span * 0.62, y + scale * 3);
      g.fill();
    }
  }

  function oval(x, y, rx, ry, color) { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

  function drawObstacle(o, x) {
    const y = GROUND, w = o.w, hh = o.h;
    const info = KINDS[o.kind];
    if (info.type === "mare") return;
    if (info.type === "abeille") {
      const by = y - (info.y0 + info.y1) / 2 + Math.sin(performance.now() / 120 + o.at) * 4;
      g.fillStyle = "#ffffffcc";
      g.beginPath(); g.ellipse(x + 16, by - 14, 10, 14, -0.5, 0, Math.PI * 2); g.ellipse(x + 30, by - 14, 10, 14, 0.5, 0, Math.PI * 2); g.fill();
      oval(x + 22, by, 22, 15, "#FFC83D");
      g.fillStyle = "#2B2350"; g.fillRect(x + 14, by - 14, 6, 28); g.fillRect(x + 26, by - 14, 6, 28);
      oval(x + 4, by - 2, 3, 3, "#2B2350");
      return;
    }
    if (info.type === "haut") {
      g.fillStyle = "#8B5E3C"; g.beginPath(); g.roundRect(x, y - hh, w, hh, 10); g.fill();
      g.strokeStyle = "#6B4A2A"; g.lineWidth = 3;
      for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + 6, y - hh * k / 5); g.lineTo(x + w - 6, y - hh * k / 5 + 6); g.stroke(); }
      oval(x + w / 2, y - hh, w / 2, 9, "#C9925E");
      oval(x + w / 2, y - hh, w / 4, 4, "#8B5E3C");
      g.fillStyle = "#6CBF5A"; g.beginPath(); g.ellipse(x + w - 4, y - hh * 0.6, 12, 6, 0.6, 0, Math.PI * 2); g.fill();
      return;
    }
    if (o.kind === "puddle") { oval(x + w / 2, y, w / 2, 8, "#286379"); oval(x + w / 2, y - 3, w * 0.45, 6, "#78D7DE"); }
    else if (o.kind === "snail") { oval(x + w / 2, y - 7, w * 0.48, 8, "#DFBF53"); oval(x + 18, y - 17, 15, 15, "#DC8750"); oval(x + 38, y - 15, 8, 10, "#F9D36B"); oval(x + 37, y - 26, 2.5, 4, "#3E3940"); }
    else if (o.kind === "duck") { oval(x + 24, y - 13, 23, 13, "#FFCD56"); oval(x + 40, y - 26, 12, 11, "#FFE37A"); oval(x + 52, y - 25, 7, 4, "#E77740"); oval(x + 43, y - 29, 2.4, 2.4, "#283043"); }
    else if (o.kind === "boot") { g.fillStyle = "#8970BF"; g.beginPath(); g.roundRect(x + 3, y - hh, w - 10, hh, 7); g.roundRect(x + 3, y - 18, w, 18, 7); g.fill(); g.fillStyle = "#F4A9CC"; g.fillRect(x + 5, y - 31, w - 14, 6); }
    else if (o.kind === "mushrooms") { g.fillStyle = "#FFE1AD"; g.fillRect(x + 9, y - 24, 7, 24); g.fillRect(x + 26, y - 31, 8, 31); oval(x + 12, y - 25, 12, 8, "#F49565"); oval(x + 30, y - 34, 14, 10, "#E75867"); oval(x + 27, y - 36, 2.7, 2.7, "#FFF5D1"); }
    else { g.fillStyle = "#79534E"; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 6; i++) { g.lineTo(x + i * 7, y - 19); g.lineTo(x + i * 7 + 2, y - hh + (i - 2) * (i - 2) * 1.3); } g.lineTo(x + 45, y); g.fill(); oval(x + 36, y - 11, 18, 10, "#C7976D"); oval(x + 43, y - 14, 2.5, 2.5, "#342B39"); }
  }

  function drawFrog(x, y, r) {
    g.save();
    g.translate(x, y);
    if (r.hit > 0) g.rotate(Math.sin(r.hit * 33) * 0.16);
    else if (r.y > 0) g.rotate(-0.15);
    const skin = ["#55D6A7", "#A6DC58", "#7CC86B", "#C9D857"][r.seat % 4];
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(0, 0, 24, 19, 0, 0, Math.PI * 2);
    g.moveTo(-1, -11); g.arc(-10, -11, 9, 0, Math.PI * 2);
    g.moveTo(19, -11); g.arc(10, -11, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#F8FFF0";
    for (const e of [-10, 10]) { g.beginPath(); g.arc(e, -11, 6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#143329";
    for (const e of [-8, 12]) { g.beginPath(); g.arc(e, -11, 2.8, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#234D38"; g.lineWidth = 2;
    g.beginPath(); g.arc(2, 0, 8, 0.15, Math.PI - 0.15); g.stroke();
    g.fillStyle = r.p.color;
    g.beginPath(); g.roundRect(-14, 10, 28, 7, 3); g.fill();
    g.restore();
  }

  const loop = createLoop(dt => { update(dt); draw(); });
  return {
    start() { say(solo ? "Touche l'écran pour sauter !" : "Touche ton couloir pour sauter !"); loop.start(); },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); document.removeEventListener("keydown", onKey); }
  };
}

function demo() {
  const node = h(`<div class="cg-demo"><span class="cg-frog"></span><span class="cg-rock"></span><span class="cg-finger">${icon("eclair")}</span></div>`);
  return { node, stop() {} };
}

export default {
  id: "course-grenouilles",
  title: "Course des grenouilles",
  players: { min: 1, max: 4 },
  robots: true,
  orientation: "landscape",
  theme: { bg: "#CDEFD8", ink: "#1F6B47" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true"><rect width="160" height="120" rx="16" fill="#BFEAD3"/><rect y="84" width="160" height="36" fill="#6B5039"/><rect y="80" width="160" height="7" fill="#A6D96A"/><ellipse cx="50" cy="62" rx="16" ry="12" fill="#55D6A7"/><ellipse cx="110" cy="80" rx="14" ry="5" fill="#78D7DE"/></svg>`,
  rules: {
    text: session => session.count === 1
      ? "Touche l'écran pour sauter, et encore une fois en l'air pour un double saut ! Saute les obstacles et les mares, mais reste au sol quand une abeille vole haut."
      : "Chacun touche son couloir pour sauter, et encore une fois en l'air pour un double saut. Attention aux mares et aux abeilles ! Trois chocs et c'est plouf : la dernière grenouille gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
