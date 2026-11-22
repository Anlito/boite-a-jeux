// Sumo-bulles : pousser les autres bulles hors d'une banquise qui rétrécit.
// Un seul geste : la flèche tourne toute seule ; maintenir pour charger, lâcher pour foncer.
import { SEATS, robotArt, shapeSVG, icon, hasImage, imagePath } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, seatAt, text, createParticles } from "../core/stage.js";

const W = 1000, CX = 500, CY = 500;
const BUBBLE = 52;
const GOAL = 3;                 // manches gagnées pour remporter le match
const SOLO_ROUNDS = 5;
const SOLO_ROBOTS = [1, 1, 2, 2, 3];   // défi libre : force des robots à chaque manche

// Niveaux solo : les robots (leur force), le nombre de manches, les manches gagnées pour 1, 2, 3 étoiles,
// les trous (à partir de la 2e manche) et la taille de la banquise.
const LEVELS = [
  { robots: [1], rounds: 3, stars: [1, 2, 3], holes: false, floe: 400, goal: "Un robot facile. Pousse-le dans l'eau !" },
  { robots: [1, 1], rounds: 3, stars: [1, 2, 3], holes: false, floe: 400, goal: "Deux robots faciles. Reste au milieu de la banquise !" },
  { robots: [2], rounds: 3, stars: [1, 2, 3], holes: false, floe: 400, goal: "Un robot plus malin. Attends le bon moment pour foncer !" },
  { robots: [1, 2], rounds: 3, stars: [1, 2, 3], holes: true, floe: 400, goal: "Des trous apparaissent dans la glace. Ne tombe pas dedans !" },
  { shield: true, robots: [2, 2], rounds: 4, stars: [1, 2, 3], holes: true, floe: 400, goal: "Deux robots moyens et des trous. Laisse-les se pousser entre eux !" },
  { shield: true, robots: [1, 1, 2], rounds: 4, stars: [1, 2, 3], holes: false, floe: 400, goal: "Trois robots sur la banquise ! Le dernier debout gagne." },
  { shield: true, seal: true, robots: [2, 3], rounds: 4, stars: [1, 2, 3], holes: true, floe: 400, goal: "Voici le robot fort. Méfie-toi de ses attaques !" },
  { shield: true, seal: true, robots: [3], rounds: 4, stars: [1, 2, 3], holes: true, floe: 330, goal: "Seul contre le robot fort, sur une petite banquise !" },
  { shield: true, seal: true, robots: [2, 2, 3], rounds: 5, stars: [1, 3, 4], holes: true, floe: 400, goal: "Trois robots, dont un fort. Courage !" },
  { shield: true, seal: true, robots: [3, 3, 3], rounds: 5, stars: [1, 3, 4], holes: true, floe: 360, goal: "Le défi des champions : trois robots forts !" }
];
const SPIN = 2.0;               // vitesse de rotation de la flèche (radians par seconde)
const FULL_CHARGE = 0.85;       // secondes pour une charge complète
const FRICTION = 1.9;           // freinage sur la glace
const POWER = [300, 440];       // élan : minimum + supplément à pleine charge
// Distance parcourue sur la glace avec une charge donnée (0 à 1), sans choc.
const glide = (charge, boost = 0) => (POWER[0] + POWER[1] * charge) * (1 + boost * 0.12) / FRICTION;
const ROBOT = {
  1: { tolerance: 0.55, charge: [0.15, 0.6], think: [0.6, 1.4], caution: 50, careless: 0.35 },
  2: { tolerance: 0.32, charge: [0.35, 0.85], think: [0.25, 0.7], caution: 80, careless: 0.1 },
  3: { tolerance: 0.18, charge: [0.5, 1], think: [0.08, 0.3], caution: 100, careless: 0 }
};
const START_ANGLE = {
  1: [Math.PI / 2],
  2: [Math.PI / 2, -Math.PI / 2],
  3: [Math.PI * 0.75, -Math.PI / 2, Math.PI * 0.25],
  4: [Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, -Math.PI * 0.75]
};

const between = (a, b) => a + Math.random() * (b - a);
const angleGap = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const soloRounds = level ? level.rounds : SOLO_ROUNDS;
  const thresholds = level ? level.stars : [1, 3, 4];
  // En solo, des robots rejoignent la banquise : ceux du niveau, ou deux robots de plus en plus forts (défi libre).
  const players = solo
    ? [ctx.seats[0], ...(level ? level.robots : [1, 1]).map((force, k) => ({ ...SEATS[k + 1], kind: "robot", level: force, label: "Robot", art: robotArt(force), boost: 0, index: k + 1 }))]
    : ctx.seats;
  const wins = players.map(() => 0);
  let soloWins = 0;

  const node = h(`<div class="sumo n${solo ? 1 : ctx.count}">
    <div class="sumo-field"></div>
    <div class="pads">${players.map((p, i) => p.kind === "human" ? `
      <div class="pad pad-${i}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="pad-inner">
          <div class="pad-button"><span class="pad-ring"></span>${shapeSVG(p.shape, "#fff")}</div>
          <div class="pad-info"><span class="pad-avatar">${p.art}</span>
            ${solo ? `<span class="pad-round"></span>` : `<span class="pad-pips">${"<i></i>".repeat(GOAL)}</span>`}</div>
        </div>
      </div>` : "").join("")}
    </div>
  </div>`);
  root.append(node);
  const field = node.querySelector(".sumo-field");
  const stage = createStage(field, { width: W, height: W, background: "#3C93CC" });
  const g = stage.ctx;
  const particles = createParticles();
  const padOf = i => node.querySelector(`.pad-${i}`);
  // Images du lot 4 (null si absentes : on garde le dessin).
  const picture = name => hasImage(`sumo-bulles/${name}`) ? artImage(`<img src="${imagePath(`sumo-bulles/${name}`)}">`) : null;
  const IMG = { ocean: picture("fond-ocean.jpg"), floe: picture("banquise.png"), cracked: picture("banquise-fissuree.png"), seal: picture("phoque.png"), shield: picture("bonus-bouclier.png"), splash: picture("eclaboussure.png") };
  const ready = img => img && img.complete && img.naturalWidth;
  // Phoque qui traverse la banquise, bouclier à ramasser.
  const useSeal = solo ? (level ? !!level.seal : true) : true;
  const useShield = solo ? (level ? !!level.shield : true) : true;
  let seal = null, sealTimer = 0, shield = null, shieldTimer = 0, splashes = [];

  let round = 0, phase = "countdown", timer = 0, floe = 400, floeMin = 210, holes = [], holeTimer = 0, bubbles = [], message = null, roundTime = 0;

  function setupRound() {
    phase = "countdown";
    timer = 3.2;
    roundTime = 0;
    floe = level?.floe || 400;
    holes = [];
    holeTimer = 5;
    message = null;
    seal = null; sealTimer = between(9, 13);
    shield = null; shieldTimer = between(5, 8);
    splashes = [];
    const n = players.length;
    bubbles = players.map((p, i) => {
      const a = START_ANGLE[n][i];
      const force = solo && p.kind === "robot" && !level ? SOLO_ROBOTS[Math.min(round, SOLO_ROUNDS - 1)] : p.level;
      return {
        seat: i, p, level: force,
        x: CX + Math.cos(a) * 240, y: CY + Math.sin(a) * 240,
        vx: 0, vy: 0,
        angle: a + Math.PI,                       // la flèche commence tournée vers le centre
        spin: i % 2 ? -SPIN : SPIN,
        charging: false, charge: 0, cooldown: 0,
        alive: true, fall: 0,
        mass: 1 + (p.boost || 0) * 0.3, shield: 0,
        image: artImage(p.kind === "robot" ? robotArt(force) : p.art),
        ai: { wait: between(0.3, 1), hold: 0 }
      };
    });
    renderPads();
    play("pop");
    say(round === 0 ? "Pousse les autres dans l'eau !" : `Manche ${round + 1} !`);
  }

  function renderPads() {
    players.forEach((p, i) => {
      const pad = padOf(i);
      if (!pad) return;
      if (solo) pad.querySelector(".pad-round").textContent = `${Math.min(round + 1, soloRounds)} / ${soloRounds}`;
      else pad.querySelectorAll(".pad-pips i").forEach((pip, k) => pip.classList.toggle("on", k < wins[i]));
    });
  }

  /* ---------- Commandes ---------- */

  function hold(i) {
    const b = bubbles[i];
    if (phase !== "play" || !b?.alive || b.cooldown > 0 || b.charging) return;
    b.charging = true;
    b.charge = 0;
  }
  function release(i) {
    const b = bubbles[i];
    if (!b?.charging) return;
    b.charging = false;
    if (phase !== "play" || !b.alive) return;
    const power = (POWER[0] + POWER[1] * Math.min(1, b.charge)) * (1 + (b.p.boost || 0) * 0.12);
    b.vx += Math.cos(b.angle) * power;
    b.vy += Math.sin(b.angle) * power;
    b.cooldown = 0.35;
    b.charge = 0;
    particles.burst(b.x - Math.cos(b.angle) * BUBBLE, b.y - Math.sin(b.angle) * BUBBLE, "#ffffffcc", { count: 8, speed: 140, size: 7, life: 0.4 });
    play("pop");
  }

  const fingers = new Map();
  const onDown = event => {
    if (phase === "done") return;
    const seat = solo ? 0 : seatAt(players.length, event.clientX, event.clientY, node.getBoundingClientRect());
    if (players[seat]?.kind !== "human") return;
    event.preventDefault();
    if ([...fingers.values()].includes(seat)) return;
    fingers.set(event.pointerId, seat);
    try { node.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
    hold(seat);
  };
  const onUp = event => {
    if (!fingers.has(event.pointerId)) return;
    const seat = fingers.get(event.pointerId);
    fingers.delete(event.pointerId);
    release(seat);
  };
  node.addEventListener("pointerdown", onDown);
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => node.addEventListener(type, onUp));
  // Clavier pour tester sur ordinateur : Espace = Bleu, Entrée = Rouge.
  const keyMap = { " ": 0, Enter: 1 };
  const onKey = event => {
    const seat = keyMap[event.key];
    if (seat === undefined || players[seat]?.kind !== "human" || event.repeat) return;
    event.preventDefault();
    event.type === "keydown" ? hold(seat) : release(seat);
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);

  /* ---------- Robots ---------- */

  function think(b, dt) {
    const rules = ROBOT[b.level];
    if (b.charging) {
      b.ai.hold -= dt;
      if (b.ai.hold <= 0) release(b.seat);
      return;
    }
    b.ai.wait -= dt;
    if (b.ai.wait > 0 || b.cooldown > 0) return;
    const fromCenter = Math.hypot(b.x - CX, b.y - CY);
    let goal, strength, target = null;
    if (fromCenter > floe - rules.caution - BUBBLE) {
      goal = Math.atan2(CY - b.y, CX - b.x);           // trop près du bord : revenir au centre
      strength = 0.5;
    } else {
      const targets = bubbles.filter(o => o.alive && o !== b);
      if (!targets.length) return;
      target = targets.reduce((best, o) => Math.hypot(o.x - b.x, o.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? o : best);
      // Viser un peu derrière la cible, du côté du centre, pour la pousser vers l'eau.
      const out = Math.atan2(target.y - CY, target.x - CX);
      goal = Math.atan2(target.y + Math.sin(out) * 20 - b.y, target.x + Math.cos(out) * 20 - b.x);
      strength = between(...rules.charge);
    }
    holes.forEach(hole => {
      if (Math.hypot(hole.x - b.x, hole.y - b.y) < hole.r + BUBBLE * 2) goal = Math.atan2(b.y - hole.y, b.x - hole.x);
    });
    if (Math.abs(angleGap(b.angle, goal)) < rules.tolerance) {
      // Avant de foncer : où vais-je m'arrêter ? On réduit l'élan pour rester sur la glace.
      if (Math.random() >= rules.careless) {
        // Si une bulle est sur le chemin, le choc arrête le robot à peu près là où elle est.
        const block = target ? Math.hypot(target.x - b.x, target.y - b.y) - BUBBLE : Infinity;
        const landsAt = charge => {
          const travel = Math.min(glide(charge, b.p.boost), block);
          return Math.hypot(b.x + Math.cos(b.angle) * travel - CX, b.y + Math.sin(b.angle) * travel - CY);
        };
        while (strength > 0 && landsAt(strength) > floe - BUBBLE) strength -= 0.1;
        if (strength <= 0) { b.ai.wait = 0.15; return; }
      }
      hold(b.seat);
      b.ai.hold = strength * FULL_CHARGE;
      b.ai.wait = between(...rules.think);
    }
  }

  /* ---------- Simulation ---------- */

  function update(dt) {
    particles.update(dt);
    if (phase === "countdown") {
      const before = Math.ceil(timer);
      timer -= dt;
      if (Math.ceil(timer) !== before && timer > 0) play("tick");
      if (timer <= 0) { phase = "play"; play("go"); }
      for (const b of bubbles) b.angle += b.spin * dt;
      return;
    }
    if (phase === "between" || phase === "done") {
      timer -= dt;
      stepPhysics(dt);
      if (phase === "between" && timer <= 0) { round++; setupRound(); }
      return;
    }
    roundTime += dt;
    // La banquise rétrécit, de plus en plus vite si la manche s'éternise.
    const smallest = roundTime > 35 ? 120 : floeMin;
    if (roundTime > 5) floe = Math.max(smallest, floe - (roundTime > 30 ? 22 : 9 + round * 2) * dt);
    if (round >= 1 && (!level || level.holes)) {
      holeTimer -= dt;
      if (holeTimer <= 0) { spawnHole(); holeTimer = Math.max(3.5, 7 - round); }
    }
    if (useSeal && (solo || round >= 1)) {
      sealTimer -= dt;
      if (sealTimer <= 0 && !seal) {
        const a = Math.random() * Math.PI * 2, turn = between(-0.3, 0.3);
        seal = { x: CX + Math.cos(a) * 560, y: CY + Math.sin(a) * 560, vx: -Math.cos(a + turn) * 230, vy: -Math.sin(a + turn) * 230, wobble: 0 };
        sealTimer = between(10, 15);
        play("trap");
      }
    }
    if (seal) {
      seal.x += seal.vx * dt; seal.y += seal.vy * dt; seal.wobble += dt * 8;
      if (Math.hypot(seal.x - CX, seal.y - CY) > 620) seal = null;
    }
    if (useShield && !shield) {
      shieldTimer -= dt;
      if (shieldTimer <= 0) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * (floe - 140);
        shield = { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, t: 0 };
        shieldTimer = between(9, 13);
      }
    }
    if (shield) {
      shield.t += dt;
      const taker = bubbles.find(b => b.alive && Math.hypot(b.x - shield.x, b.y - shield.y) < BUBBLE + 30);
      if (taker) { taker.shield = 6; shield = null; play("star"); particles.burst(taker.x, taker.y, "#FFC83D", { count: 14, speed: 220, size: 8, life: 0.6 }); }
      else if (Math.hypot(shield.x - CX, shield.y - CY) > floe - 30) shield = null;
    }
    for (const b of bubbles) b.shield = Math.max(0, b.shield - dt);
    for (const hole of holes) hole.r = Math.min(hole.max, hole.r + dt * (hole.r < 4 ? 2 : 40) * (hole.warn > 0 ? 0 : 1)), hole.warn -= dt;
    for (const b of bubbles) {
      if (!b.alive) continue;
      b.cooldown = Math.max(0, b.cooldown - dt);
      if (b.charging) b.charge = Math.min(1, b.charge + dt / FULL_CHARGE);
      else b.angle += b.spin * dt;
      if (b.p.kind === "robot") think(b, dt);
    }
    stepPhysics(dt);
    // Qui est tombé à l'eau ?
    for (const b of bubbles) {
      if (!b.alive) continue;
      const out = Math.hypot(b.x - CX, b.y - CY) > floe + BUBBLE * 0.15;
      const inHole = holes.some(hole => hole.warn <= 0 && Math.hypot(hole.x - b.x, hole.y - b.y) < hole.r - BUBBLE * 0.25);
      if (out || inHole) {
        b.alive = false;
        splashes.push({ x: b.x, y: b.y, age: 0 });
        b.charging = false;
        particles.burst(b.x, b.y, "#E6F7FF", { count: 22, speed: 320, size: 10, life: 0.8 });
        particles.burst(b.x, b.y, b.p.color, { count: 8, speed: 200, size: 8, life: 0.6 });
        play("wrong");
      }
    }
    const alive = bubbles.filter(b => b.alive);
    if (alive.length <= 1) endRound(alive[0]);
  }

  function stepPhysics(dt) {
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      const t = dt / steps;
      for (const b of bubbles) {
        if (!b.alive) { b.fall = Math.min(1, b.fall + t * 2.5); continue; }
        b.vx *= Math.exp(-FRICTION * t);
        b.vy *= Math.exp(-FRICTION * t);
        b.x += b.vx * t;
        b.y += b.vy * t;
      }
      // Le phoque bouscule les bulles (il est bien plus lourd qu'elles).
      if (seal) for (const b of bubbles) {
        if (!b.alive) continue;
        const dx = b.x - seal.x, dy = b.y - seal.y, dist = Math.hypot(dx, dy) || 1;
        if (dist >= BUBBLE + 44) continue;
        const nx = dx / dist, ny = dy / dist;
        b.x = seal.x + nx * (BUBBLE + 44);
        b.y = seal.y + ny * (BUBBLE + 44);
        const push = (b.vx - seal.vx) * nx + (b.vy - seal.vy) * ny;
        if (push < 0) { const k = b.shield > 0 ? 0.6 : 1.8; b.vx -= push * nx * k; b.vy -= push * ny * k; play("tap"); }
      }
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], c = bubbles[j];
          if (!a.alive || !c.alive) continue;
          const dx = c.x - a.x, dy = c.y - a.y, dist = Math.hypot(dx, dy) || 1;
          if (dist >= BUBBLE * 2) continue;
          const nx = dx / dist, ny = dy / dist, overlap = BUBBLE * 2 - dist;
          // Avec le bouclier, une bulle pèse trois fois plus lourd.
          const ma = a.mass * (a.shield > 0 ? 3 : 1), mc = c.mass * (c.shield > 0 ? 3 : 1);
          const total = ma + mc;
          a.x -= nx * overlap * (mc / total); a.y -= ny * overlap * (mc / total);
          c.x += nx * overlap * (ma / total); c.y += ny * overlap * (ma / total);
          const relative = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (relative >= 0) continue;
          const impulse = -(1 + 0.95) * relative / (1 / ma + 1 / mc);
          a.vx -= impulse * nx / ma; a.vy -= impulse * ny / ma;
          c.vx += impulse * nx / mc; c.vy += impulse * ny / mc;
          if (-relative > 120) {
            particles.burst((a.x + c.x) / 2, (a.y + c.y) / 2, "#ffffff", { count: 6, speed: 180, size: 6, life: 0.35 });
            play("tap");
          }
        }
      }
    }
  }

  function spawnHole() {
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * (floe - 120);
      const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
      if (bubbles.some(b => b.alive && Math.hypot(b.x - x, b.y - y) < 150)) continue;
      holes.push({ x, y, r: 0, max: between(48, 70), warn: 1.3 });
      play("trap");
      return;
    }
  }

  function endRound(winner) {
    phase = "between";
    timer = 2.4;
    if (solo) {
      const won = winner?.seat === 0;
      if (won) soloWins++;
      message = won ? "Gagné !" : "Plouf !";
      play(won ? "point" : "trap");
      if (round + 1 >= soloRounds) return finishSolo();
      return;
    }
    if (!winner) { message = "Égalité !"; return; }
    wins[winner.seat]++;
    renderPads();
    message = `${winner.p.label} gagne la manche !`;
    play("point");
    if (wins[winner.seat] >= GOAL) {
      phase = "done";
      ctx.finish({ ranking: wins.map((score, seat) => ({ seat, score, label: `${score} manche${score > 1 ? "s" : ""}` })) });
    }
  }

  function finishSolo() {
    phase = "done";
    const stars = thresholds.filter(need => soloWins >= need).length;
    ctx.finish({
      solo: {
        stars, value: soloWins, lowerIsBetter: false,
        format: v => `${v} manche${v > 1 ? "s" : ""} gagnée${v > 1 ? "s" : ""}`,
        label: `${soloWins} manche${soloWins > 1 ? "s" : ""} gagnée${soloWins > 1 ? "s" : ""} sur ${soloRounds}`,
        speech: soloWins ? `Tu as gagné ${soloWins} manche${soloWins > 1 ? "s" : ""} !` : "Les robots étaient coriaces !",
        next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : gagner ${thresholds[stars]} manche${thresholds[stars] > 1 ? "s" : ""}`
      }
    });
  }

  /* ---------- Dessin ---------- */

  function draw() {
    stage.begin();
    // L'eau
    if (ready(IMG.ocean)) {
      const k = W / IMG.ocean.naturalHeight;
      g.drawImage(IMG.ocean, CX - IMG.ocean.naturalWidth * k / 2, 0, IMG.ocean.naturalWidth * k, W);
    }
    const sea = g.createRadialGradient(CX, CY, 200, CX, CY, 760);
    sea.addColorStop(0, "#7FD0F2");
    sea.addColorStop(1, "#3C93CC");
    g.fillStyle = sea;
    if (!ready(IMG.ocean)) g.fillRect(0, 0, W, W);
    g.strokeStyle = "#ffffff33";
    g.lineWidth = 5;
    g.lineCap = "round";
    const t = performance.now() / 1000;
    for (let i = 0; i < 14; i++) {
      const x = (i * 157 + t * 18) % 1100 - 50, y = (i * 263) % 1000;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 20, y - 10, x + 40, y);
      g.stroke();
    }
    // La banquise (image du lot 4, fissurée quand la manche s'éternise)
    const floeImg = roundTime > 25 && ready(IMG.cracked) ? IMG.cracked : IMG.floe;
    if (ready(floeImg)) {
      const size = floe * 2.12;
      g.drawImage(floeImg, CX - size / 2, CY - size / 2, size, size);
    } else {
    g.fillStyle = "#3B7FB0";
    g.beginPath(); g.ellipse(CX, CY + 16, floe, floe, 0, 0, Math.PI * 2); g.fill();
    const ice = g.createRadialGradient(CX - floe * 0.3, CY - floe * 0.3, 20, CX, CY, floe);
    ice.addColorStop(0, "#FFFFFF");
    ice.addColorStop(1, "#D3EEFA");
    g.fillStyle = ice;
    g.beginPath(); g.arc(CX, CY, floe, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#A9DDF3";
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = "#ffffffaa";
    g.lineWidth = 8;
    g.beginPath(); g.arc(CX, CY, floe * 0.82, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    }
    // Les trous
    for (const hole of holes) {
      if (hole.warn > 0) {
        g.strokeStyle = "#7BB7D6";
        g.lineWidth = 4;
        for (let k = 0; k < 5; k++) {
          const a = k * 1.3;
          g.beginPath(); g.moveTo(hole.x, hole.y); g.lineTo(hole.x + Math.cos(a) * hole.max * 0.9, hole.y + Math.sin(a) * hole.max * 0.9); g.stroke();
        }
        continue;
      }
      g.fillStyle = "#3C93CC";
      g.beginPath(); g.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#A9DDF3"; g.lineWidth = 5; g.stroke();
    }
    // Bouclier à ramasser, éclaboussures
    if (shield) {
      const bob = Math.sin(shield.t * 4) * 6, size = 70;
      if (ready(IMG.shield)) g.drawImage(IMG.shield, shield.x - size / 2, shield.y - size / 2 + bob, size, size);
      else { g.fillStyle = "#FFC83D"; g.beginPath(); g.arc(shield.x, shield.y + bob, 26, 0, Math.PI * 2); g.fill(); }
    }
    for (const sp of splashes) {
      sp.age += 1 / 60;
      if (sp.age > 0.9) continue;
      const size = 90 + sp.age * 160;
      g.globalAlpha = 1 - sp.age / 0.9;
      if (ready(IMG.splash)) g.drawImage(IMG.splash, sp.x - size / 2, sp.y - size / 2, size, size);
      g.globalAlpha = 1;
    }
    splashes = splashes.filter(sp => sp.age <= 0.9);
    // Les bulles, puis le phoque par-dessus
    for (const b of bubbles) drawBubble(b);
    if (seal) {
      g.save(); g.translate(seal.x, seal.y); g.rotate(Math.atan2(seal.vy, seal.vx) + Math.PI / 2 + Math.sin(seal.wobble) * 0.08);
      if (ready(IMG.seal)) g.drawImage(IMG.seal, -60, -60, 120, 120);
      else { g.fillStyle = "#A3ABC0"; g.beginPath(); g.ellipse(0, 0, 30, 46, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    particles.draw(g);
    // Annonces
    if (phase === "countdown") {
      const n = Math.ceil(timer);
      text(g, n > 3 ? "" : n > 0 ? String(n) : "", CX, CY, { size: 150, color: "#fff", stroke: "#2B2350" });
    } else if (message && (phase === "between" || phase === "done")) {
      text(g, message, CX, CY, { size: message.length > 14 ? 54 : 90, color: "#fff", stroke: "#2B2350" });
    }
  }

  function drawBubble(b) {
    const scale = b.alive ? 1 : 1 - b.fall;
    if (scale <= 0.02) return;
    g.save();
    g.translate(b.x, b.y);
    g.scale(scale, scale);
    g.globalAlpha = b.alive ? 1 : 1 - b.fall * 0.6;
    // Ombre
    g.fillStyle = "#2B235022";
    g.beginPath(); g.ellipse(0, BUBBLE * 0.85, BUBBLE * 0.9, BUBBLE * 0.3, 0, 0, Math.PI * 2); g.fill();
    // Flèche (plus longue pendant la charge)
    if (b.alive) {
      const reach = BUBBLE + 18 + b.charge * 34;
      g.save();
      g.rotate(b.angle);
      g.fillStyle = b.p.color;
      g.strokeStyle = "#fff";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(reach + 22, 0); g.lineTo(reach, -16); g.lineTo(reach, 16); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    // Bulle
    g.fillStyle = b.p.soft;
    g.beginPath(); g.arc(0, 0, BUBBLE, 0, Math.PI * 2); g.fill();
    if (b.image.complete && b.image.naturalWidth !== 0) {
      // Image recadrée dans la bulle : les avatars livrés ont une marge autour du personnage.
      g.save();
      g.beginPath(); g.arc(0, 0, BUBBLE - 3, 0, Math.PI * 2); g.clip();
      const size = BUBBLE * 2.15;
      g.drawImage(b.image, -size / 2, -size / 2 + BUBBLE * 0.08, size, size);
      g.restore();
    }
    g.lineWidth = 7;
    g.strokeStyle = b.p.color;
    g.beginPath(); g.arc(0, 0, BUBBLE, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff99";
    g.beginPath(); g.ellipse(-BUBBLE * 0.42, -BUBBLE * 0.5, BUBBLE * 0.22, BUBBLE * 0.12, -0.6, 0, Math.PI * 2); g.fill();
    // Bouclier
    if (b.shield > 0 && b.alive) {
      g.strokeStyle = Math.floor(b.shield * 6) % 2 && b.shield < 1.5 ? "#FFC83D55" : "#FFC83D";
      g.lineWidth = 8;
      g.beginPath(); g.arc(0, 0, BUBBLE + 6, 0, Math.PI * 2); g.stroke();
    }
    // Jauge de charge
    if (b.charging) {
      g.strokeStyle = "#fff";
      g.lineWidth = 9;
      g.beginPath(); g.arc(0, 0, BUBBLE + 12, -Math.PI / 2, -Math.PI / 2 + b.charge * Math.PI * 2); g.stroke();
    }
    g.restore();
  }

  function updatePads() {
    bubbles.forEach(b => {
      const pad = padOf(b.seat);
      if (!pad) return;
      pad.style.setProperty("--charge", b.charge.toFixed(3));
      pad.classList.toggle("holding", b.charging);
      pad.classList.toggle("out", !b.alive);
    });
  }

  const loop = createLoop(dt => { update(dt); draw(); updatePads(); });

  return {
    start() { setupRound(); loop.start(); },
    pause() { loop.stop(); fingers.forEach(seat => release(seat)); fingers.clear(); },
    resume() { loop.start(); },
    destroy() {
      loop.stop();
      stage.destroy();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    }
  };
}

/* ---------- Démonstration des règles ---------- */

function demo() {
  const node = h(`<div class="sumo-demo">
    <div class="sumo-demo-ice"><span class="sumo-demo-a"></span><span class="sumo-demo-b"></span></div>
    <div class="sumo-demo-finger">${icon("eclair")}</div>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "sumo-bulles",
  title: "Sumo-bulles",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#CDEEFB", ink: "#1F5C8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <ellipse cx="80" cy="68" rx="66" ry="40" fill="#7FD0F2"/>
    <ellipse cx="80" cy="66" rx="54" ry="31" fill="#fff" stroke="#A9DDF3" stroke-width="3"/>
    <circle cx="58" cy="62" r="17" fill="#DCE9FC" stroke="#2F80ED" stroke-width="4"/>
    <circle cx="104" cy="64" r="17" fill="#FCDEDE" stroke="#EB5757" stroke-width="4"/>
    <path d="M78 63 l10 -6 v12z" fill="#2F80ED"/>
    <circle cx="54" cy="59" r="2.6" fill="#2B2350"/><circle cx="63" cy="59" r="2.6" fill="#2B2350"/>
    <circle cx="100" cy="61" r="2.6" fill="#2B2350"/><circle cx="109" cy="61" r="2.6" fill="#2B2350"/>
    <path d="M118 52 q6 -4 10 0 M122 78 q6 4 10 0" stroke="#1F5C8A" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "La flèche tourne toute seule. Garde le doigt appuyé pour charger, lâche pour foncer ! Pousse les robots dans l'eau, mais ne tombe pas !"
      : `La flèche tourne toute seule. Garde le doigt appuyé dans ta zone pour charger, lâche pour foncer ! Le dernier sur la banquise gagne la manche. ${GOAL} manches pour gagner !`,
    demo
  },
  levels: LEVELS,
  mount
};
