// Tir aux étoiles : lancer une bille qui rebondit sur les champignons et ramasse des étoiles.
// Chacun son tour, trois billes chacun, sur le même plateau. L'étoile d'or vaut 5 points.
import { icon } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, text, createParticles } from "../core/stage.js";

const W = 800, H = 1000, BALL = 12, LAUNCH = { x: 400, y: 935 }, GRAVITY = 520;
const COLORS = { 1: "#70ECFF", 2: "#A5F29C", 3: "#FFA9E3", 5: "#FFC83D" };
const ROBOT = { 1: { angle: 0.12, power: 0.1, tries: 40 }, 2: { angle: 0.05, power: 0.05, tries: 90 }, 3: { angle: 0.015, power: 0.015, tries: 160 } };
const SHOTS = 3;

// Valeur d'une étoile : plus elle est haute, plus elle rapporte.
const valueAt = y => (y < 300 ? 3 : y < 560 ? 2 : 1);

// Plateaux dessinés à la main : champignons [x, y, rayon], étoiles [x, y], étoile d'or, points pour 1/2/3 étoiles.
const arc = (cx, cy, r, from, to, count) => Array.from({ length: count }, (_, i) => {
  const a = from + (to - from) * (count === 1 ? 0.5 : i / (count - 1));
  return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
});
const LEVELS = [
  { bumpers: [], stars: arc(400, 620, 220, Math.PI * 1.15, Math.PI * 1.85, 5), gold: [400, 250], need: [4, 8, 12], goal: "Tire en arrière puis lâche : la bille ramasse les étoiles qu'elle touche !" },
  { bumpers: [[260, 520, 34], [540, 520, 34]], stars: [...arc(400, 600, 260, Math.PI * 1.1, Math.PI * 1.9, 6), [400, 470]], gold: [400, 200], need: [5, 10, 15], goal: "Les champignons font rebondir la bille. Utilise-les !" },
  { bumpers: [[400, 450, 50]], stars: arc(400, 450, 130, 0, Math.PI * 2 - 0.6, 8), gold: [400, 160], need: [6, 12, 18], goal: "Un anneau d'étoiles autour d'un gros champignon." },
  { bumpers: [[200, 300, 30], [200, 520, 30], [600, 300, 30], [600, 520, 30]], stars: [[400, 250], [400, 360], [400, 470], [300, 420], [500, 420], [130, 410], [670, 410], [400, 580]], gold: [400, 140], need: [7, 13, 19], goal: "Deux colonnes de champignons. Vise au milieu !" },
  { bumpers: [[300, 420, 28], [500, 420, 28], [400, 330, 28]], stars: [[90, 200], [130, 320], [710, 200], [670, 320], [90, 520], [710, 520], [400, 230]], gold: [60, 80], need: [6, 12, 18], goal: "Des étoiles près des bords : fais rebondir la bille sur les murs !" },
  { bumpers: [[400, 560, 30], [330, 460, 30], [470, 460, 30], [260, 360, 30], [400, 360, 30], [540, 360, 30]], stars: [[400, 200], [300, 240], [500, 240], [200, 260], [600, 260], [400, 460], [150, 520], [650, 520]], gold: [400, 110], need: [8, 15, 22], goal: "Une pyramide de champignons. La bille va rebondir partout !" },
  { bumpers: [[200, 600, 26], [600, 500, 26], [200, 400, 26], [600, 300, 26]], stars: [[300, 650], [500, 550], [300, 450], [500, 350], [300, 250], [500, 160], [120, 300], [680, 640]], gold: [400, 90], need: [8, 15, 22], goal: "Un zigzag de champignons jusqu'en haut !" },
  { bumpers: [[400, 420, 44], [250, 560, 30], [550, 560, 30]], stars: [[70, 70], [160, 110], [730, 70], [640, 110], [400, 250], [400, 620], [120, 700], [680, 700]], gold: [400, 60], need: [8, 16, 24], goal: "Les meilleures étoiles sont dans les coins du haut !" },
  { bumpers: [[200, 300, 24], [400, 300, 24], [600, 300, 24], [300, 430, 24], [500, 430, 24], [200, 560, 24], [400, 560, 24], [600, 560, 24]], stars: [[300, 300], [500, 300], [200, 430], [400, 430], [600, 430], [300, 560], [500, 560], [400, 180], [120, 180], [680, 180]], gold: [400, 80], need: [10, 19, 28], goal: "Une forêt de champignons. Ça va rebondir dans tous les sens !" },
  { bumpers: [[400, 470, 36], [260, 330, 26], [540, 330, 26], [260, 610, 26], [540, 610, 26]], stars: [...arc(400, 470, 120, 0, Math.PI * 2 - 0.5, 7), ...arc(400, 470, 250, Math.PI * 1.05, Math.PI * 1.95, 5)], gold: [400, 120], need: [11, 21, 31], goal: "Le défi des champions : deux anneaux d'étoiles !" }
];
const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const board = ctx.level || LEVELS[2 + Math.floor(Math.random() * 7)];
  const players = ctx.seats.map((p, i) => ({ seat: i, p, shots: 0, points: 0, picked: new Set(), gold: false }));
  const stage = createStage(root, { width: W, height: H, background: "#2A1F5E" });
  const g = stage.ctx;
  const particles = createParticles();
  const stars = board.stars.map(([x, y], i) => ({ id: i, x, y, value: valueAt(y) }));
  const gold = { id: "gold", x: board.gold[0], y: board.gold[1], value: 5 };
  const banner = h(`<div class="cn-overlay"><div class="cn-banner" hidden><span class="cn-banner-art"></span><span class="cn-banner-text"></span></div></div>`);
  root.append(banner);
  const bannerBox = banner.querySelector(".cn-banner");

  let turn = -1, phase = "banner", timer = 1.3, ball = null, aim = null, angle = -Math.PI / 2, robotPlan = null, shotPoints = 0, message = null;
  const current = () => players[turn];

  function nextTurn() {
    const left = players.filter(pl => pl.shots < SHOTS);
    if (!left.length) return finish();
    do { turn = (turn + 1) % players.length; } while (players[turn].shots >= SHOTS);
    phase = "banner";
    angle = -Math.PI / 2;
    robotPlan = null;
    const pl = current();
    const first = pl.shots === 0;
    timer = solo && !first ? 0.01 : 1.3;
    if (solo && !first) return;
    bannerBox.hidden = false;
    bannerBox.style.setProperty("--seat", pl.p.color);
    bannerBox.querySelector(".cn-banner-art").innerHTML = pl.p.art;
    bannerBox.querySelector(".cn-banner-text").textContent = pl.p.kind === "robot" ? `Au tour de ${pl.p.label}` : solo ? "Trois billes !" : `À toi, ${pl.p.label} !`;
    if (pl.p.kind === "human" && !solo) say(`À toi, ${pl.p.label} !`);
    play("pop");
  }

  function startAim() {
    bannerBox.hidden = true;
    phase = "aim";
    if (current().p.kind === "robot") robotPlan = plan(current());
  }

  /* ---------- Bille ---------- */

  const speedOf = power => 520 + 760 * power;
  function launch(a, power) {
    const v = speedOf(power);
    ball = { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, trail: [] };
    shotPoints = 0;
    current().shots++;
    phase = "flight";
    play("go");
  }

  // Un pas de simulation. effects = false pour les prévisions (visée, robots).
  function step(b, dt, picked, effects) {
    b.age += dt;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < BALL) { b.x = BALL; b.vx = Math.abs(b.vx) * 0.92; if (effects) play("tap"); }
    if (b.x > W - BALL) { b.x = W - BALL; b.vx = -Math.abs(b.vx) * 0.92; if (effects) play("tap"); }
    if (b.y < BALL) { b.y = BALL; b.vy = Math.abs(b.vy) * 0.85; }
    for (const [x, y, r] of board.bumpers) {
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy), contact = r + BALL;
      if (d >= contact) continue;
      const nx = d ? dx / d : 0, ny = d ? dy / d : -1;
      b.x = x + nx * (contact + 0.5);
      b.y = y + ny * (contact + 0.5);
      const impact = b.vx * nx + b.vy * ny;
      if (impact < 0) {
        b.vx -= 2 * impact * nx;
        b.vy -= 2 * impact * ny;
        const v = Math.hypot(b.vx, b.vy), boost = Math.min(1100, v + 60) / v;
        b.vx *= boost; b.vy *= boost;
        if (effects) { particles.burst(b.x, b.y, "#D6ABFF", { count: 6, speed: 160, size: 6, life: 0.35 }); play("tap"); }
      }
    }
    let gained = 0;
    for (const s of [...stars, gold]) {
      if (picked.has(s.id) || Math.hypot(b.x - s.x, b.y - s.y) > 32) continue;
      picked.add(s.id);
      gained += s.value;
      if (effects) {
        particles.burst(s.x, s.y, COLORS[s.value], { count: s.value === 5 ? 30 : 12, speed: s.value === 5 ? 380 : 240, size: 8, life: 0.8 });
        play(s.value === 5 ? "win" : "point");
      }
    }
    return gained;
  }
  const gone = b => b.y > H + 30 || b.age > 12;

  /* ---------- Robots : essaient des tirs en pensée, gardent le meilleur ---------- */

  function plan(pl) {
    const rules = ROBOT[pl.p.level];
    let best = { a: -Math.PI / 2, power: 0.6, score: -1 };
    for (let k = 0; k < rules.tries; k++) {
      const a = between(-Math.PI + 0.25, -0.25), power = between(0.25, 1);
      const v = speedOf(power);
      const b = { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0 };
      const picked = new Set(pl.picked);
      let score = 0;
      while (!gone(b)) score += step(b, 1 / 60, picked, false);
      if (score > best.score) best = { a, power, score };
    }
    return { a: best.a + between(-rules.angle, rules.angle), power: clamp(best.power + between(-rules.power, rules.power), 0.2, 1), wait: 1 };
  }

  /* ---------- Visée au doigt ---------- */

  function aimFrom(start, point) {
    const dx = start.x - point.x, dy = start.y - point.y;
    let a = Math.atan2(dy, dx);
    if (a > 0) a = a < Math.PI / 2 ? -0.25 : -Math.PI + 0.25;
    return { a: clamp(a, -Math.PI + 0.25, -0.25), power: clamp(Math.hypot(dx, dy) / 260, 0, 1) };
  }
  const onDown = event => {
    if (phase === "banner" && timer < 1.1) { timer = 0; return; }
    if (phase !== "aim" || current().p.kind !== "human" || aim) return;
    event.preventDefault();
    try { root.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
    aim = { id: event.pointerId, start: stage.toWorld(event.clientX, event.clientY), a: angle, power: 0 };
  };
  const onMove = event => {
    if (!aim || aim.id !== event.pointerId) return;
    Object.assign(aim, aimFrom(aim.start, stage.toWorld(event.clientX, event.clientY)));
    angle = aim.a;
  };
  const onUp = event => {
    if (!aim || aim.id !== event.pointerId) return;
    const { a, power } = aim;
    aim = null;
    if (phase === "aim" && power > 0.1) launch(a, power);
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", () => { aim = null; });

  /* ---------- Boucle ---------- */

  function update(dt) {
    particles.update(dt);
    if (message) { message.time -= dt; if (message.time <= 0) message = null; }
    if (phase === "banner") { timer -= dt; if (timer <= 0) startAim(); }
    else if (phase === "aim" && robotPlan) {
      robotPlan.wait -= dt;
      angle += clamp(robotPlan.a - angle, -2 * dt, 2 * dt);
      if (robotPlan.wait <= 0 && Math.abs(robotPlan.a - angle) < 0.02) launch(robotPlan.a, robotPlan.power);
    } else if (phase === "flight" && ball) {
      const pl = current();
      for (let k = 0; k < 6; k++) {
        const gained = step(ball, dt / 6, pl.picked, true);
        if (gained) { pl.points += gained; shotPoints += gained; if (pl.picked.has("gold")) pl.gold = true; }
        if (gone(ball)) break;
      }
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 14) ball.trail.shift();
      if (gone(ball)) {
        ball = null;
        phase = "settle";
        timer = 1;
        message = { text: shotPoints ? `+${shotPoints}` : "Raté !", time: 1 };
      }
    } else if (phase === "settle") {
      timer -= dt;
      if (timer <= 0) nextTurn();
    }
  }

  function finish() {
    phase = "done";
    setTimeout(() => {
      if (solo) {
        const pl = players[0];
        const stars = board.need.filter(need => pl.points >= need).length;
        ctx.finish({
          solo: {
            stars, value: pl.points, lowerIsBetter: false,
            format: v => `${v} points`,
            label: `${pl.points} point${pl.points > 1 ? "s" : ""} avec ${SHOTS} billes${pl.gold ? " · étoile d'or !" : ""}`,
            speech: pl.gold ? "Tu as eu l'étoile d'or !" : `Tu as fait ${pl.points} points !`,
            next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : ${board.need[stars]} points`
          }
        });
        return;
      }
      ctx.finish({ ranking: players.map(pl => ({ seat: pl.seat, score: pl.points, label: `${pl.points} point${pl.points > 1 ? "s" : ""}` })) });
    }, 700);
  }

  /* ---------- Dessin ---------- */

  function draw() {
    stage.begin();
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#251A57"); sky.addColorStop(1, "#6B3776");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) { g.fillStyle = "#F4D9AB66"; g.beginPath(); g.arc((i * 137 + 31) % W, (i * 71 + 19) % H, 2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#8E78C9"; g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H);
    const pl = current() || players[0];
    for (const [x, y, r] of board.bumpers) {
      g.fillStyle = "#211A45"; g.beginPath(); g.arc(x, y + 4, r + 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#9D74DD"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#523783"; g.beginPath(); g.arc(x, y, r * 0.66, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#CFACFF"; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.35, r * 0.15, -0.4, 0, Math.PI * 2); g.fill();
    }
    for (const s of [...stars, gold]) {
      if (pl.picked.has(s.id)) continue;
      drawStar(s.x, s.y, s.value === 5 ? 36 : 27, COLORS[s.value], s.value === 5);
      text(g, String(s.value), s.x, s.y + 2, { size: s.value === 5 ? 24 : 19, color: "#35214B" });
    }
    // Lanceur et visée
    g.fillStyle = "#201942"; g.beginPath(); g.ellipse(LAUNCH.x, LAUNCH.y + 10, 60, 36, 0, 0, Math.PI * 2); g.fill();
    if (phase === "aim" || phase === "banner") {
      if (aim && aim.power > 0.05) {
        const v = speedOf(aim.power);
        const b = { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, age: 0 };
        const fake = new Set(pl.picked);
        g.fillStyle = "#FFF1B5";
        for (let k = 1; k <= 40; k++) { step(b, 1 / 60, fake, false); if (k % 4 === 0) { g.globalAlpha = 1 - k / 44; g.beginPath(); g.arc(b.x, b.y, 4, 0, Math.PI * 2); g.fill(); } }
        g.globalAlpha = 1;
      } else {
        g.save(); g.translate(LAUNCH.x, LAUNCH.y); g.rotate(angle);
        g.fillStyle = "#FFF1B588"; g.beginPath(); g.moveTo(70, 0); g.lineTo(46, -10); g.lineTo(46, 10); g.fill();
        g.restore();
      }
      g.fillStyle = pl.p.color; g.beginPath(); g.arc(LAUNCH.x, LAUNCH.y, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFF8E0"; g.beginPath(); g.arc(LAUNCH.x - 6, LAUNCH.y - 6, 5, 0, Math.PI * 2); g.fill();
      if (!aim && pl.p.kind === "human" && phase === "aim") text(g, "Tire en arrière", LAUNCH.x, LAUNCH.y - 80, { size: 30, color: "#fff", stroke: "#2A1F5E" });
    }
    if (ball) {
      ball.trail.forEach((p, i) => { g.globalAlpha = i / ball.trail.length * 0.5; g.fillStyle = pl.p.color; g.beginPath(); g.arc(p.x, p.y, 4 + i * 0.5, 0, Math.PI * 2); g.fill(); });
      g.globalAlpha = 1;
      g.fillStyle = "#FFF4D9"; g.beginPath(); g.arc(ball.x, ball.y, BALL, 0, Math.PI * 2); g.fill();
    }
    particles.draw(g);
    // Scores
    const top = players.map(p => `${solo ? "" : p.p.label + " "}${p.points}`).join("   ·   ");
    g.fillStyle = "#ffffffe6"; g.beginPath(); g.roundRect(W / 2 - 300, 20, 600, 54, 27); g.fill();
    text(g, solo ? `Score : ${players[0].points}` : top, W / 2, 47, { size: players.length > 2 ? 22 : 28 });
    const balls = "●".repeat(Math.max(0, SHOTS - pl.shots)) + "○".repeat(Math.min(SHOTS, pl.shots));
    text(g, balls, W / 2, H - 22, { size: 30, color: pl.p.color });
    if (message) text(g, message.text, W / 2, 480, { size: 70, color: "#FFDC6F", stroke: "#2A1F5E" });
  }

  function drawStar(x, y, r, color, shine) {
    g.save();
    if (shine) { g.shadowColor = "#FFC83D"; g.shadowBlur = 24; }
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.48 : r;
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.restore();
  }

  const loop = createLoop(dt => { update(dt); draw(); });
  return {
    start() { nextTurn(); say(solo ? "Tire en arrière puis lâche !" : "Chacun son tour, trois billes chacun !"); loop.start(); },
    pause() { loop.stop(); aim = null; },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); }
  };
}

function demo() {
  const node = h(`<div class="te-demo"><span class="te-bumper"></span><span class="te-star a"></span><span class="te-star b"></span><span class="te-ball"></span></div>`);
  return { node, stop() {} };
}

export default {
  id: "tir-etoiles",
  title: "Tir aux étoiles",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#E9DDFF", ink: "#5A43D6" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true"><rect width="160" height="120" rx="16" fill="#3A2A75"/><circle cx="80" cy="60" r="14" fill="#9D74DD"/><path d="M40 30 l4 9 10 1 -8 6 3 10 -9 -5 -9 5 3 -10 -8 -6 10 -1z" fill="#FFC83D"/><circle cx="80" cy="104" r="8" fill="#FFF4D9"/></svg>`,
  rules: {
    text: session => session.count === 1
      ? "Tire en arrière puis lâche : la bille rebondit sur les champignons et ramasse les étoiles. Trois billes. L'étoile d'or vaut 5 points !"
      : "Chacun son tour, trois billes chacun, sur le même plateau. Tire en arrière puis lâche ! L'étoile d'or vaut 5 points. Le plus de points gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
