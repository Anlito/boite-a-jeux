// Petits bolides : course de petites voitures vue de dessus, sur un circuit au milieu de l'écran.
// La voiture avance toute seule ; on la dirige avec un joystick qui apparaît sous le doigt, dans son coin.
// Taches d'huile (la voiture glisse) et flèches turbo. Le premier qui finit ses tours gagne.
import { SEATS, robotArt } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, text, createParticles } from "../core/stage.js";

const W = 1600, H = 1000;
const ROAD = 132;                // largeur de la route
const CAR = 19;                  // rayon de choc d'une voiture
const TOP = 340, ACCEL = 260, GRIP = 2.9;
const OFFROAD = 0.5;             // vitesse dans l'herbe
const DEAD = 0.08;               // joystick : zone morte (en fraction du rayon)

// Circuits : points de passage (0 à 1 sur la largeur et la hauteur), dans le sens de la course.
const ellipse = (k, rx = 0.4, ry = 0.36) => Array.from({ length: k }, (_, i) => [0.5 + Math.cos(i / k * Math.PI * 2) * rx, 0.5 + Math.sin(i / k * Math.PI * 2) * ry]);
const CIRCUITS = [
  { name: "L'anneau", points: ellipse(12) },
  { name: "Le stade", points: [[.15, .28], [.5, .2], [.85, .28], [.92, .5], [.85, .72], [.5, .8], [.15, .72], [.08, .5]] },
  { name: "Le haricot", points: [[.15, .3], [.35, .14], [.65, .14], [.86, .32], [.86, .68], [.68, .86], [.56, .62], [.44, .62], [.32, .86], [.14, .68]] },
  { name: "Le grand L", points: [[.1, .15], [.45, .15], [.52, .48], [.9, .52], [.9, .85], [.1, .85]] },
  { name: "Les virages", points: [[.08, .3], [.3, .14], [.5, .36], [.7, .14], [.92, .3], [.92, .72], [.7, .86], [.5, .64], [.3, .86], [.08, .72]] },
  { name: "Le triangle", points: [[.5, .12], [.7, .48], [.9, .85], [.5, .88], [.1, .85], [.3, .48]] },
  { name: "L'épingle", points: [[.1, .12], [.9, .12], [.92, .35], [.36, .35], [.36, .65], [.9, .65], [.92, .88], [.1, .88]] },
  { name: "Les trois bosses", points: [[.2, .2], [.5, .34], [.8, .14], [.9, .5], [.76, .86], [.5, .7], [.24, .86], [.1, .5]] },
  { name: "Le serpent", points: [[.07, .2], [.3, .12], [.42, .4], [.56, .12], [.76, .12], [.93, .3], [.76, .5], [.93, .74], [.72, .88], [.46, .7], [.25, .88], [.07, .72]] },
  { name: "Le labyrinthe", points: [[.08, .12], [.38, .12], [.42, .34], [.6, .34], [.64, .12], [.92, .12], [.92, .88], [.64, .88], [.6, .66], [.42, .66], [.38, .88], [.08, .88]] }
];

// Niveaux solo : circuit, robots, tours, taches d'huile et turbos (positions sur le tour, de 0 à 1).
const LEVELS = [
  { circuit: 0, robots: [1], laps: 2, oil: [], boost: [], goal: "La voiture avance toute seule. Pose ton doigt et glisse-le vers où tu veux aller !" },
  { circuit: 1, robots: [1], laps: 2, oil: [], boost: [.12, .62], goal: "Des flèches turbo ! Passe dessus pour aller plus vite." },
  { circuit: 2, robots: [1, 1], laps: 2, oil: [], boost: [.1, .55], goal: "Deux robots et un virage en creux. Reste sur la route !" },
  { circuit: 3, robots: [2], laps: 3, oil: [.35, .8], boost: [.1, .55], goal: "Attention aux taches d'huile : ta voiture va glisser !" },
  { circuit: 4, robots: [1, 2], laps: 3, oil: [.3, .7], boost: [.05, .5], goal: "Plein de virages. Tourne au bon moment !" },
  { circuit: 5, robots: [2, 2], laps: 3, oil: [.25, .6], boost: [.1, .45, .8], goal: "Deux robots malins sur le triangle." },
  { circuit: 6, robots: [3], laps: 3, oil: [.3, .62], boost: [.08, .5], goal: "Voici le robot fort, et un virage en épingle !" },
  { circuit: 7, robots: [2, 3], laps: 3, oil: [.2, .5, .78], boost: [.06, .4, .7], goal: "Trois bosses et trois taches d'huile." },
  { circuit: 8, robots: [2, 2, 3], laps: 3, oil: [.22, .55, .85], boost: [.05, .38, .7], goal: "Le circuit du serpent, avec trois robots !" },
  { circuit: 9, robots: [3, 3, 3], laps: 3, oil: [.18, .45, .72], boost: [.05, .32, .6, .88], goal: "Le défi des champions : le labyrinthe contre trois robots forts !" }
];
const MULTI = { laps: 3, oil: [.3, .7], boost: [.08, .55] };
const ROBOT = {
  1: { speed: 0.74, look: 10, wobble: 0.35 },
  2: { speed: 0.88, look: 13, wobble: 0.15 },
  3: { speed: 0.97, look: 16, wobble: 0.05 }
};
const INK = "#2B2350";

const between = (a, b) => a + Math.random() * (b - a);
const angleGap = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Courbe fermée qui passe par les points (Catmull-Rom), échantillonnée régulièrement.
function buildTrack(points) {
  const P = points.map(([x, y]) => [130 + x * (W - 260), 120 + y * (H - 240)]);
  const raw = [];
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 30; k++) {
      const t = k / 30, t2 = t * t, t3 = t2 * t;
      raw.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  // Rééchantillonnage tous les 12 pixels environ.
  const out = [raw[0]];
  let carry = 0;
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1], b = raw[i % raw.length];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]), pos = 12 - carry;
    while (pos <= seg) { const t = pos / seg; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); pos += 12; }
    carry = seg - (pos - 12);
  }
  out.pop();
  return out.map(([x, y], i) => {
    const next = out[(i + 1) % out.length];
    return { x, y, a: Math.atan2(next[1] - y, next[0] - x) };
  });
}

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const setup = solo ? (level || { ...MULTI, circuit: Math.floor(Math.random() * CIRCUITS.length), robots: [1, 2, 2] }) : { ...MULTI, circuit: Math.floor(Math.random() * CIRCUITS.length) };
  const players = solo
    ? [ctx.seats[0], ...setup.robots.map((force, k) => ({ ...SEATS[k + 1], kind: "robot", level: force, label: "Robot", art: robotArt(force), boost: 0, index: k + 1 }))]
    : ctx.seats;
  const N = players.length;
  const track = buildTrack(CIRCUITS[setup.circuit].points);
  const T = track.length;
  const LAPS = setup.laps;

  const stage = createStage(root, { width: W, height: H, background: "#7BC96A" });
  const g = stage.ctx;
  const particles = createParticles();
  const scenery = paintScenery();

  const items = [
    ...setup.oil.map((f, k) => ({ kind: "oil", ...offsetPoint(Math.floor(f * T), k % 2 ? 26 : -26) })),
    ...setup.boost.map(f => ({ kind: "boost", ...offsetPoint(Math.floor(f * T), 0), a: track[Math.floor(f * T)].a }))
  ];
  function offsetPoint(i, side) {
    const p = track[i];
    return { x: p.x + Math.cos(p.a + Math.PI / 2) * side, y: p.y + Math.sin(p.a + Math.PI / 2) * side };
  }

  // Grille de départ : derrière la ligne, deux par deux.
  const cars = players.map((p, i) => {
    const back = 4 + Math.floor(i / 2) * 5, side = (i % 2 ? 1 : -1) * 30;
    const s = track[(T - back) % T];
    return {
      seat: i, p, x: s.x + Math.cos(s.a + Math.PI / 2) * side, y: s.y + Math.sin(s.a + Math.PI / 2) * side,
      angle: s.a, speed: 0, idx: (T - back) % T, lap: 0, half: false, done: false, time: 0, place: 0,
      aim: null, slide: 0, turbo: 0, spin: 0,
      image: artImage(p.kind === "robot" ? robotArt(p.level) : p.art),
      ai: { offset: between(-30, 30), next: 0 }
    };
  });

  let phase = "countdown", timer = 3.4, raceTime = 0, finished = [], endTimer = 0;

  /* ---------- Commandes : joystick dans son coin ---------- */

  const sticks = new Map();
  // Quel joueur touche ? On regarde dans le repère du terrain (il peut être tourné).
  function seatOf(world) {
    if (solo) return 0;
    const top = world.y < H / 2, left = world.x < W / 2;
    if (N === 2) return top ? 1 : 0;
    if (N === 3) return top ? 1 : left ? 0 : 2;
    return top ? (left ? 3 : 1) : (left ? 0 : 2);
  }
  const onDown = event => {
    if (phase === "done") return;
    const world = stage.toWorld(event.clientX, event.clientY);
    const seat = seatOf(world);
    if (players[seat]?.kind !== "human" || [...sticks.values()].some(s => s.seat === seat)) return;
    event.preventDefault();
    sticks.set(event.pointerId, { seat, x0: world.x, y0: world.y, x: world.x, y: world.y });
    try { stage.canvas.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
  };
  const onMove = event => {
    const stick = sticks.get(event.pointerId);
    if (!stick) return;
    const world = stage.toWorld(event.clientX, event.clientY);
    stick.x = world.x; stick.y = world.y;
    const dx = world.x - stick.x0, dy = world.y - stick.y0;
    if (Math.hypot(dx, dy) > 90 * DEAD * 3) cars[stick.seat].aim = Math.atan2(dy, dx);
  };
  const onUp = event => {
    const stick = sticks.get(event.pointerId);
    if (!stick) return;
    sticks.delete(event.pointerId);
    cars[stick.seat].aim = null;
  };
  stage.canvas.addEventListener("pointerdown", onDown);
  stage.canvas.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => stage.canvas.addEventListener(type, onUp));
  // Clavier pour tester : flèches pour Bleu.
  const keys = {};
  const onKey = event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    keys[event.key] = event.type === "keydown";
    const dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (players[0].kind === "human") cars[0].aim = dx || dy ? Math.atan2(dy, dx) : null;
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);

  /* ---------- Simulation ---------- */

  // Point du circuit le plus proche (on cherche autour du dernier connu).
  function nearest(c) {
    let best = c.idx, bestD = Infinity;
    for (let k = -25; k <= 25; k++) {
      const i = (c.idx + k + T) % T, p = track[i];
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { i: best, dist: Math.sqrt(bestD) };
  }

  function think(c) {
    const brain = ROBOT[c.p.level] || ROBOT[2];
    const ahead = track[(c.idx + brain.look) % T];
    if (raceTime > c.ai.next) { c.ai.offset = between(-38, 38) * (0.5 + brain.wobble); c.ai.next = raceTime + between(1.5, 3); }
    const side = ahead.a + Math.PI / 2;
    const tx = ahead.x + Math.cos(side) * c.ai.offset, ty = ahead.y + Math.sin(side) * c.ai.offset;
    c.aim = Math.atan2(ty - c.y, tx - c.x) + (Math.random() < brain.wobble * 0.05 ? between(-0.6, 0.6) : 0);
  }

  function update(dt) {
    particles.update(dt);
    if (phase === "countdown") {
      const before = Math.ceil(timer);
      timer -= dt;
      if (Math.ceil(timer) !== before && timer > 0) play("tick");
      if (timer <= 0) { phase = "race"; play("go"); say("Partez !"); }
      return;
    }
    if (phase === "done") return;
    raceTime += dt;
    for (const c of cars) {
      if (c.p.kind === "robot" && !c.done) think(c);
      const brain = c.p.kind === "robot" ? ROBOT[c.p.level] || ROBOT[2] : null;
      const here = nearest(c);
      c.idx = here.i;
      const onRoad = here.dist < ROAD / 2;
      let top = TOP * (brain ? brain.speed : 1 - (c.p.boost || 0) * 0) * (onRoad ? 1 : OFFROAD) * (c.turbo > 0 ? 1.45 : 1) * (c.done ? 0.4 : 1);
      // Braquer fort ralentit la voiture : elle prend les virages serrés sans tourner en rond.
      if (c.aim !== null && c.spin <= 0) top *= 1 - 0.55 * Math.min(1, Math.abs(angleGap(c.aim, c.angle)) / 1.1);
      // Coup de pouce : la voiture garde sa vitesse même dans l'herbe.
      if (!onRoad && c.p.boost) top = Math.max(top, TOP * (0.5 + c.p.boost * 0.2));
      c.speed += Math.sign(top - c.speed) * Math.min(Math.abs(top - c.speed), ACCEL * dt * (c.speed > top ? 1.6 : 1));
      // Direction : vers le joystick, plus lentement à faible vitesse.
      if (c.spin > 0) { c.spin -= dt; c.angle += 7 * dt; }
      else if (c.aim !== null) {
        const gap = angleGap(c.aim, c.angle);
        c.angle += Math.sign(gap) * Math.min(Math.abs(gap), GRIP * dt * Math.min(1, 0.4 + c.speed / 200));
      }
      c.turbo = Math.max(0, c.turbo - dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = Math.max(20, Math.min(W - 20, c.x));
      c.y = Math.max(20, Math.min(H - 20, c.y));
      // Tours : il faut passer par la moitié du circuit avant de recroiser la ligne.
      if (c.idx > T * 0.45 && c.idx < T * 0.55) c.half = true;
      if (c.half && here.i < T * 0.1 && c.lastIdx > T * 0.9) {
        c.half = false;
        c.lap++;
        if (c.lap >= LAPS && !c.done) {
          c.done = true; c.time = raceTime; finished.push(c); c.place = finished.length;
          play(c.place === 1 ? "win" : "point");
          particles.burst(c.x, c.y, c.p.color, { count: 24, speed: 300, size: 9, life: 1 });
        } else if (!c.done) play("star");
      }
      c.lastIdx = here.i;
      // Objets
      for (const it of items) {
        if (Math.hypot(it.x - c.x, it.y - c.y) > 34) continue;
        if (it.kind === "boost" && c.turbo <= 0) { c.turbo = 1.2; play("pop"); }
        if (it.kind === "oil" && c.spin <= 0 && !c.oilCool) { c.spin = 0.6; c.speed *= 0.6; c.oilCool = true; play("wrong"); setTimeout(() => { c.oilCool = false; }, 1200); }
      }
    }
    // Chocs entre voitures
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d >= CAR * 2) continue;
      const push = (CAR * 2 - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      a.speed *= 0.97; b.speed *= 0.97;
    }
    // Fin de course
    const humans = cars.filter(c => c.p.kind === "human");
    if (humans.every(c => c.done) || (solo && cars[0].done)) end();
    else if (finished.length) { endTimer += dt; if (endTimer > 20) end(); }
  }

  // Classement : les arrivés dans l'ordre, puis les autres selon leur avance.
  function standings() {
    const rest = cars.filter(c => !c.done).sort((a, b) => (b.lap * T + b.idx) - (a.lap * T + a.idx));
    return [...finished, ...rest];
  }

  function end() {
    if (phase === "done") return;
    phase = "done";
    const order = standings();
    const fmt = v => `${v.toFixed(1).replace(".", ",")} s`;
    if (solo) {
      const place = order.indexOf(cars[0]) + 1;
      const stars = place === 1 ? 3 : place === 2 ? 2 : 1;
      setTimeout(() => ctx.finish({
        solo: {
          stars, value: Math.round(cars[0].time * 10) / 10, lowerIsBetter: true,
          format: fmt,
          label: `${place === 1 ? "1er" : place + "e"} sur ${N} · ${LAPS} tours en ${fmt(cars[0].time)}`,
          speech: place === 1 ? "Tu as gagné la course !" : `Tu finis ${place === 2 ? "deuxième" : place === 3 ? "troisième" : "quatrième"} !`,
          next: stars === 3 ? "" : stars === 2 ? "3 étoiles : finir premier" : "2 étoiles : finir deuxième"
        }
      }), 900);
      return;
    }
    setTimeout(() => ctx.finish({
      ranking: order.map((c, k) => ({ seat: c.seat, score: N - k, label: c.done ? fmt(c.time) : `Tour ${Math.min(c.lap + 1, LAPS)}` }))
    }), 900);
  }

  /* ---------- Dessin ---------- */

  function paintScenery() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const b = c.getContext("2d");
    b.fillStyle = "#86D17A"; b.fillRect(0, 0, W, H);
    // Touffes d'herbe et fleurs
    for (let k = 0; k < 140; k++) {
      const x = Math.random() * W, y = Math.random() * H;
      b.fillStyle = k % 9 === 0 ? "#FFD93D" : k % 7 === 0 ? "#FF9AA8" : "#6DBE5E";
      b.beginPath(); b.arc(x, y, k % 7 === 0 || k % 9 === 0 ? 5 : 9, 0, Math.PI * 2); b.fill();
    }
    const path = () => { b.beginPath(); track.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.closePath(); };
    b.lineJoin = "round"; b.lineCap = "round";
    // Bordure rouge et blanche, puis la route
    path(); b.strokeStyle = INK; b.lineWidth = ROAD + 26; b.stroke();
    path(); b.strokeStyle = "#fff"; b.lineWidth = ROAD + 18; b.stroke();
    path(); b.setLineDash([26, 26]); b.strokeStyle = "#EB5757"; b.lineWidth = ROAD + 18; b.stroke(); b.setLineDash([]);
    path(); b.strokeStyle = "#8C86A6"; b.lineWidth = ROAD; b.stroke();
    path(); b.strokeStyle = "#ffffff88"; b.lineWidth = 5; b.setLineDash([30, 30]); b.stroke(); b.setLineDash([]);
    // Ligne d'arrivée en damier
    const s = track[0], nx = Math.cos(s.a + Math.PI / 2), ny = Math.sin(s.a + Math.PI / 2);
    b.save(); b.translate(s.x, s.y); b.rotate(s.a + Math.PI / 2);
    for (let r = 0; r < 2; r++) for (let k = -6; k < 6; k++) { b.fillStyle = (k + r) % 2 ? "#fff" : INK; b.fillRect(k * 11, -11 + r * 11, 11, 11); }
    b.restore();
    void nx; void ny;
    return c;
  }

  function drawCar(c) {
    g.save();
    g.translate(c.x, c.y);
    g.fillStyle = "#00000030";
    g.beginPath(); g.ellipse(4, 6, 30, 18, c.angle, 0, Math.PI * 2); g.fill();
    g.rotate(c.angle);
    // Roues
    g.fillStyle = INK;
    for (const [x, y] of [[-17, -16], [13, -16], [-17, 16], [13, 16]]) { g.beginPath(); g.roundRect(x - 7, y - 4, 14, 8, 3); g.fill(); }
    // Carrosserie
    g.fillStyle = c.p.color; g.strokeStyle = INK; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(-27, -15, 54, 30, 12); g.fill(); g.stroke();
    g.fillStyle = "#ffffffaa";
    g.beginPath(); g.roundRect(8, -11, 10, 22, 4); g.fill();
    // Pilote (avatar) dans le cockpit
    g.rotate(-c.angle);
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
    if (c.image.complete && c.image.naturalWidth) {
      g.save(); g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.clip();
      g.drawImage(c.image, -15, -14, 30, 30); g.restore();
    }
    g.restore();
    if (c.turbo > 0) particles.burst(c.x - Math.cos(c.angle) * 28, c.y - Math.sin(c.angle) * 28, "#FFC83D", { count: 1, speed: 60, size: 6, life: 0.3 });
  }

  function drawItem(it, t) {
    g.save(); g.translate(it.x, it.y);
    if (it.kind === "oil") {
      g.fillStyle = "#2B2350dd";
      g.beginPath(); g.ellipse(0, 0, 30, 20, 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7B61FF88"; g.beginPath(); g.ellipse(-8, -5, 9, 5, 0.4, 0, Math.PI * 2); g.fill();
    } else {
      g.rotate(it.a);
      const pulse = 0.6 + Math.sin(t * 6) * 0.4;
      for (let k = 0; k < 2; k++) {
        g.fillStyle = `rgba(255, 200, 61, ${pulse})`; g.strokeStyle = INK; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-14 + k * 20, -18); g.lineTo(6 + k * 20, 0); g.lineTo(-14 + k * 20, 18); g.lineTo(-4 + k * 20, 0); g.closePath(); g.fill(); g.stroke();
      }
    }
    g.restore();
  }

  // Petit panneau dans le coin de chaque enfant : son pilote et son tour.
  function drawHud(c) {
    if (c.p.kind !== "human") return;
    const seat = c.seat;
    const top = solo ? false : N === 2 ? seat === 1 : seat === 1 || seat === 3;
    const left = solo ? true : N === 2 ? seat === 0 : seat === 0 || seat === 3;
    const x = left ? 150 : W - 150, y = top ? 54 : H - 54;
    g.save(); g.translate(x, y); if (top) g.rotate(Math.PI);
    g.fillStyle = "#ffffffe6"; g.strokeStyle = c.p.color; g.lineWidth = 5;
    g.beginPath(); g.roundRect(-120, -34, 240, 68, 34); g.fill(); g.stroke();
    const label = c.done ? (c.place === 1 ? "1er !" : `${c.place}e`) : `Tour ${Math.min(c.lap + 1, LAPS)} / ${LAPS}`;
    text(g, label, 26, 2, { size: 32, color: c.p.deep });
    if (c.image.complete && c.image.naturalWidth) g.drawImage(c.image, -112, -28, 56, 56);
    g.restore();
  }

  function draw() {
    const t = performance.now() / 1000;
    stage.begin();
    g.drawImage(scenery, 0, 0);
    items.forEach(it => drawItem(it, t));
    cars.forEach(drawCar);
    particles.draw(g);
    cars.forEach(drawHud);
    // Joysticks sous les doigts
    for (const s of sticks.values()) {
      const c = cars[s.seat];
      const dx = s.x - s.x0, dy = s.y - s.y0, d = Math.hypot(dx, dy), k = d > 70 ? 70 / d : 1;
      g.fillStyle = c.p.color + "33"; g.strokeStyle = c.p.color; g.lineWidth = 5;
      g.beginPath(); g.arc(s.x0, s.y0, 90, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = c.p.color; g.strokeStyle = "#fff"; g.lineWidth = 5;
      g.beginPath(); g.arc(s.x0 + dx * k, s.y0 + dy * k, 40, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (phase === "countdown") {
      const n = Math.ceil(timer);
      text(g, n > 3 ? CIRCUITS[setup.circuit].name : n > 0 ? String(n) : "", W / 2, H / 2, { size: n > 3 ? 80 : 160, color: "#fff", stroke: INK });
    } else if (phase === "race" && raceTime < 1) {
      text(g, "Partez !", W / 2, H / 2, { size: 120, color: "#fff", stroke: INK });
    }
    if (solo && phase !== "countdown") text(g, `${raceTime.toFixed(1).replace(".", ",")} s`, W - 130, 50, { size: 38, color: "#fff", stroke: INK });
  }

  const loop = createLoop(dt => { update(dt); draw(); });

  return {
    start() { loop.start(); },
    pause() { loop.stop(); sticks.clear(); cars.forEach(c => { if (c.p.kind === "human") c.aim = null; }); },
    resume() { loop.start(); },
    destroy() {
      loop.stop();
      stage.destroy();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    }
  };
}

function demo() {
  const node = h(`<div class="pb-demo"><div class="pb-demo-track"><span class="pb-demo-car"></span></div><div class="sp-demo-joy"><i></i></div></div>`);
  return { node, stop() {} };
}

export default {
  id: "petits-bolides",
  title: "Petits bolides",
  players: { min: 1, max: 4 },
  robots: true,
  orientation: "landscape",
  theme: { bg: "#D8F0C8", ink: "#2F6B2A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect width="160" height="120" rx="14" fill="#86D17A"/>
    <ellipse cx="80" cy="60" rx="58" ry="38" fill="none" stroke="#2B2350" stroke-width="22"/>
    <ellipse cx="80" cy="60" rx="58" ry="38" fill="none" stroke="#8C86A6" stroke-width="16"/>
    <rect x="58" y="14" width="22" height="13" rx="5" fill="#2F80ED" stroke="#2B2350" stroke-width="2"/>
    <rect x="96" y="92" width="22" height="13" rx="5" fill="#EB5757" stroke="#2B2350" stroke-width="2"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Ta voiture avance toute seule. Pose ton doigt et fais-le glisser vers où tu veux aller. Reste sur la route, prends les flèches turbo et évite l'huile !"
      : "Chaque voiture avance toute seule. Pose ton doigt dans ton coin et fais-le glisser vers où tu veux aller. Reste sur la route ! Le premier qui finit ses tours gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
