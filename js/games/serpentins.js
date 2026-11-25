// Serpentins : chaque serpent avance tout seul et laisse une trace. On tourne à gauche ou à droite
// pour ne toucher ni les bords, ni les traces. Le dernier serpent en vie gagne la manche.
// Pommes : le serpent saute un instant (il passe par-dessus les traces et laisse un trou).
// Portails : on entre dans l'un, on ressort par l'autre.
import { SEATS, robotArt } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, seatAt, text, createParticles } from "../core/stage.js";

const FH = 1000;                 // hauteur du terrain ; la largeur suit la forme de l'écran
const WALL = 26;                 // épaisseur du bord
const R = 6;                     // demi-épaisseur d'une trace
const CELL = 4;                  // case de la grille des traces
const TURN = 3.0;                // vitesse de virage (radians par seconde)
const GRACE = 0.3;               // on ne se cogne pas dans sa propre trace toute fraîche
const HEAD = 18;                 // taille dessinée de la tête
const JUMP = 1.1;                // durée du saut donné par une pomme
const PORTAL = 30;
const GOAL = 3;                  // manches gagnées pour remporter le match
const SOLO_ROUNDS = 5;
const SOLO_ROBOTS = [1, 1, 2, 2, 3];   // défi libre : force des robots à chaque manche

// Niveaux solo : robots, manches, manches gagnées pour 1, 2, 3 étoiles, vitesse de départ,
// pommes, paires de portails, trous qui s'ouvrent tout seuls dans les traces.
const LEVELS = [
  { robots: [1], rounds: 3, stars: [1, 2, 3], speed: 105, apples: false, portals: 0, goal: "Un robot facile. Tourne pour ne rien toucher !" },
  { robots: [1], rounds: 3, stars: [1, 2, 3], speed: 110, apples: true, portals: 0, goal: "Mange les pommes : ton serpent saute par-dessus les traces !" },
  { robots: [1, 1], rounds: 3, stars: [1, 2, 3], speed: 110, apples: true, portals: 0, goal: "Deux robots faciles. Garde de la place autour de toi !" },
  { robots: [2], rounds: 3, stars: [1, 2, 3], speed: 115, apples: true, portals: 1, goal: "Des portails ! Entre dans l'un, tu ressors par l'autre." },
  { robots: [1, 2], rounds: 4, stars: [1, 2, 3], speed: 120, apples: true, portals: 1, goal: "Deux robots, dont un plus malin. Enferme-les !" },
  { robots: [2, 2], rounds: 4, stars: [1, 2, 3], speed: 120, apples: true, portals: 1, gaps: true, goal: "Des trous s'ouvrent dans les traces. Faufile-toi !" },
  { robots: [3], rounds: 4, stars: [1, 2, 3], speed: 125, apples: true, portals: 2, goal: "Voici le robot fort, et deux paires de portails !" },
  { robots: [2, 3], rounds: 4, stars: [1, 2, 3], speed: 135, apples: true, portals: 2, gaps: true, goal: "Ça va plus vite ! Tourne au bon moment." },
  { robots: [2, 2, 3], rounds: 5, stars: [1, 3, 4], speed: 135, apples: true, portals: 1, gaps: true, goal: "Trois robots, dont un fort. Courage !" },
  { robots: [3, 3, 3], rounds: 5, stars: [1, 3, 4], speed: 145, apples: true, portals: 2, gaps: true, goal: "Le défi des champions : trois robots forts !" }
];
const MULTI = { speed: 120, apples: true, portals: 1, gaps: false };
const FREE = { speed: 120, apples: true, portals: 1, gaps: true };
// look : distance regardée devant, think : temps de réflexion, mistake : chance de mal choisir.
const ROBOT = {
  1: { look: 75, think: 0.28, mistake: 0.18, apple: 0 },
  2: { look: 170, think: 0.12, mistake: 0.04, apple: 0.5 },
  3: { look: 280, think: 0.05, mistake: 0, apple: 1 }
};
const START_ANGLE = {
  1: [Math.PI / 2],
  2: [Math.PI / 2, -Math.PI / 2],
  3: [Math.PI * 0.75, -Math.PI / 2, Math.PI * 0.25],
  4: [Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, -Math.PI * 0.75]
};
const PORTAL_COLORS = ["#FF9F43", "#2ED3C6"];
const INK = "#2B2350";

const between = (a, b) => a + Math.random() * (b - a);
const angleGap = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : MULTI;
  const soloRounds = level ? level.rounds : SOLO_ROUNDS;
  const thresholds = level ? level.stars : [1, 3, 4];
  const players = solo
    ? [ctx.seats[0], ...(level ? level.robots : [1, 1]).map((force, k) => ({ ...SEATS[k + 1], kind: "robot", level: force, label: "Robot", art: robotArt(force), boost: 0, index: k + 1 }))]
    : ctx.seats;
  const n = players.length;
  const wins = players.map(() => 0);
  let soloWins = 0;

  const node = h(`<div class="sp n${solo ? 1 : ctx.count}">
    <div class="sp-field"></div>
    <div class="pads">${players.map((p, i) => p.kind === "human" ? `
      <div class="pad sp-pad pad-${i}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="pad-inner">
          <div class="sp-joy" aria-hidden="true"><i></i></div>
          <div class="pad-info"><span class="pad-avatar">${p.art}</span>
            ${solo ? `<span class="pad-round"></span>` : `<span class="pad-pips">${"<i></i>".repeat(GOAL)}</span>`}</div>
        </div>
      </div>` : "").join("")}
    </div>
  </div>`);
  root.append(node);
  const field = node.querySelector(".sp-field");
  // Le terrain épouse la forme de la zone de jeu (entre les manettes).
  // (La partie n'est pas encore affichée ici : on calcule d'après la fenêtre, comme le CSS de .sp.)
  const band = Math.min(86, Math.max(54, Math.min(innerWidth, innerHeight) * 0.14)) + 22;
  const fieldHeight = innerHeight - band * (solo ? 1 : 2);
  const FW = Math.round(Math.min(2400, Math.max(520, FH * innerWidth / Math.max(200, fieldHeight))));
  const CX = FW / 2, CY = FH / 2;
  const stage = createStage(field, { width: FW, height: FH, background: "#1B2145" });
  const g = stage.ctx;
  const particles = createParticles();
  const padOf = i => node.querySelector(`.pad-${i}`);

  // Grille des traces : à quel moment la case a été peinte, et par qui.
  const COLS = Math.ceil(FW / CELL), ROWS = Math.ceil(FH / CELL);
  const when = new Float32Array(COLS * ROWS);
  const owner = new Uint8Array(COLS * ROWS);
  // Les traces sont peintes une fois pour toutes sur une toile à part.
  const SHARP = 1.5;
  const trail = document.createElement("canvas");
  trail.width = Math.round(FW * SHARP); trail.height = Math.round(FH * SHARP);
  const tg = trail.getContext("2d");
  const board = paintBoard();

  let round = 0, phase = "countdown", timer = 0, clock = 1, roundTime = 0, message = null;
  let snakes = [], apple = null, appleTimer = 0, portals = [];

  /* ---------- Manches ---------- */

  function setupRound() {
    phase = "countdown";
    timer = 3.2;
    roundTime = 0;
    message = null;
    when.fill(0);
    clock = 1;
    tg.clearRect(0, 0, trail.width, trail.height);
    apple = null;
    appleTimer = between(3, 5);
    portals = makePortals(rules.portals || 0);
    const rx = Math.min(330, FW / 2 - 170), ry = Math.min(330, FH / 2 - 170);
    snakes = players.map((p, i) => {
      const a = START_ANGLE[n][i];
      const force = solo && p.kind === "robot" && !level ? SOLO_ROBOTS[Math.min(round, SOLO_ROUNDS - 1)] : p.level;
      return {
        seat: i, p, level: force,
        x: CX + Math.cos(a) * rx, y: CY + Math.sin(a) * ry,
        angle: a + Math.PI / 2 + between(-0.2, 0.2),   // tous tournent dans le même sens autour du centre
        turn: 0, keys: { "-1": false, "1": false }, aim: null,
        alive: true, jump: 0, portalWait: 0,
        gap: 0, gapTimer: between(2.5, 4),
        lx: null, ly: null,
        slow: 1 - (p.boost || 0) * 0.1,              // coup de pouce : un serpent un peu plus lent
        image: artImage(p.kind === "robot" ? robotArt(force) : p.art),
        ai: { wait: between(0.1, 0.3), turn: 0 }
      };
    });
    renderPads();
    play("pop");
    say(round === 0 ? "Tourne pour ne rien toucher !" : `Manche ${round + 1} !`);
  }

  function makePortals(pairs) {
    const list = [];
    if (pairs >= 1) list.push({ a: { x: CX - FW * 0.27, y: CY }, b: { x: CX + FW * 0.27, y: CY }, color: PORTAL_COLORS[0] });
    if (pairs >= 2) list.push({ a: { x: CX, y: CY - FH * 0.16 }, b: { x: CX, y: CY + FH * 0.16 }, color: PORTAL_COLORS[1] });
    return list;
  }

  function renderPads() {
    players.forEach((p, i) => {
      const pad = padOf(i);
      if (!pad) return;
      pad.classList.remove("out");
      if (solo) pad.querySelector(".pad-round").textContent = `${Math.min(round + 1, soloRounds)} / ${soloRounds}`;
      else pad.querySelectorAll(".pad-pips i").forEach((pip, k) => pip.classList.toggle("on", k < wins[i]));
    });
  }

  function endRound() {
    const alive = snakes.filter(s => s.alive);
    phase = "between";
    timer = 2.6;
    if (solo) {
      const won = snakes[0].alive;
      if (won) soloWins++;
      message = won ? "Gagné !" : "Aïe !";
      play(won ? "point" : "trap");
      if (round + 1 >= soloRounds) finishSolo();
      return;
    }
    if (!alive.length) { message = "Égalité !"; return; }
    // Plus aucun enfant en jeu : les robots encore là gagnent la manche ensemble.
    alive.forEach(s => wins[s.seat]++);
    renderPads();
    message = alive.length === 1 ? `${alive[0].p.label} gagne la manche !` : "Les robots gagnent !";
    play("point");
    if (wins.some(w => w >= GOAL)) {
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
        speech: soloWins ? `Tu as gagné ${soloWins} manche${soloWins > 1 ? "s" : ""} !` : "Les robots ont été plus malins !",
        next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : gagner ${thresholds[stars]} manche${thresholds[stars] > 1 ? "s" : ""}`
      }
    });
  }

  /* ---------- Grille des traces ---------- */

  function stamp(x, y, seat) {
    const c0 = Math.max(0, Math.floor((x - R) / CELL)), c1 = Math.min(COLS - 1, Math.floor((x + R) / CELL));
    const r0 = Math.max(0, Math.floor((y - R) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((y + R) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * CELL - x, dy = (r + 0.5) * CELL - y;
        if (dx * dx + dy * dy > (R + 1) * (R + 1)) continue;
        const k = r * COLS + c;
        if (!when[k]) { when[k] = clock; owner[k] = seat; }
      }
    }
  }

  // Ce point est-il un mur ou une trace ?
  function blocked(x, y, seat, ignoreTrails = false) {
    if (x < WALL || y < WALL || x > FW - WALL || y > FH - WALL) return true;
    if (ignoreTrails) return false;
    const k = Math.floor(y / CELL) * COLS + Math.floor(x / CELL);
    const t = when[k];
    if (!t) return false;
    return !(owner[k] === seat && clock - t < GRACE);
  }

  function hits(s) {
    const ghost = s.jump > 0;
    for (const off of [0, -0.55, 0.55]) {
      const reach = off ? R : R + 1.5;
      if (blocked(s.x + Math.cos(s.angle + off) * reach, s.y + Math.sin(s.angle + off) * reach, s.seat, ghost)) return true;
    }
    return false;
  }

  /* ---------- Commandes ---------- */

  function setKey(seat, dir, down) {
    const s = snakes[seat];
    if (!s) return;
    s.keys[dir] = down;
    s.turn = (s.keys["1"] ? 1 : 0) - (s.keys["-1"] ? 1 : 0);
  }

  // Joystick : on pose le doigt n'importe où dans sa zone, puis on le fait glisser vers où le serpent
  // doit aller. Le joystick apparaît sous le doigt. Doigt levé : le serpent continue tout droit.
  const DEAD = 12, REACH = 46;
  const fingers = new Map();
  function aimFrom(stick, x, y) {
    const dx = x - stick.x0, dy = y - stick.y0, dist = Math.hypot(dx, dy);
    const k = dist > REACH ? REACH / dist : 1;
    stick.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (dist > DEAD && snakes[stick.seat]) snakes[stick.seat].aim = Math.atan2(dy, dx);
  }
  const onDown = event => {
    if (phase === "done") return;
    const seat = solo ? 0 : seatAt(players.length, event.clientX, event.clientY, node.getBoundingClientRect());
    if (players[seat]?.kind !== "human" || [...fingers.values()].some(f => f.seat === seat)) return;
    event.preventDefault();
    const box = node.getBoundingClientRect();
    const el = h(`<div class="sp-stick" style="left:${event.clientX - box.left}px;top:${event.clientY - box.top}px;--seat:${players[seat].color}"><i></i></div>`);
    node.append(el);
    fingers.set(event.pointerId, { seat, x0: event.clientX, y0: event.clientY, el, knob: el.firstElementChild });
    try { node.setPointerCapture(event.pointerId); } catch { /* doigt déjà relâché */ }
  };
  const onMove = event => {
    const stick = fingers.get(event.pointerId);
    if (stick) aimFrom(stick, event.clientX, event.clientY);
  };
  const release = id => {
    const stick = fingers.get(id);
    if (!stick) return;
    fingers.delete(id);
    stick.el.remove();
    if (snakes[stick.seat]) snakes[stick.seat].aim = null;
  };
  const onUp = event => release(event.pointerId);
  node.addEventListener("pointerdown", onDown);
  node.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => node.addEventListener(type, onUp));
  // Clavier pour tester sur ordinateur : flèches = Bleu, Q / D = Rouge.
  const keyMap = { ArrowLeft: [0, -1], ArrowRight: [0, 1], q: [1, -1], d: [1, 1] };
  const onKey = event => {
    const entry = keyMap[event.key];
    if (!entry || players[entry[0]]?.kind !== "human" || event.repeat) return;
    event.preventDefault();
    setKey(entry[0], entry[1], event.type === "keydown");
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);

  /* ---------- Robots ---------- */

  // Distance libre devant le serpent s'il tourne (turn) pendant une partie du trajet, puis va tout droit.
  function probe(s, turn, look, bend) {
    let x = s.x, y = s.y, a = s.angle;
    const step = 5, perUnit = TURN / speedOf(s);
    for (let d = step; d <= look; d += step) {
      if (d <= look * bend) a += turn * perUnit * step;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      if (blocked(x, y, s.seat)) return d;
    }
    return look;
  }

  function think(s, dt) {
    s.ai.wait -= dt;
    if (s.ai.wait > 0) return;
    const ai = ROBOT[s.level] || ROBOT[2];
    s.ai.wait = ai.think * between(0.7, 1.3);
    const options = [-1, 0, 1].map(turn => ({
      turn,
      free: turn ? Math.max(probe(s, turn, ai.look, 1), probe(s, turn, ai.look, 0.4)) : probe(s, 0, ai.look, 0)
    }));
    const best = Math.max(...options.map(o => o.free));
    let choice;
    if (Math.random() < ai.mistake) choice = options[Math.floor(Math.random() * 3)];
    else {
      const good = options.filter(o => o.free >= best - 4);
      choice = good.find(o => o.turn === s.ai.turn) || good.find(o => o.turn === 0) || good[0];
      // Une pomme en vue et la voie est libre : on va la chercher.
      if (apple && best >= ai.look * 0.9 && Math.random() < ai.apple) {
        const gap = angleGap(Math.atan2(apple.y - s.y, apple.x - s.x), s.angle);
        const towards = Math.abs(gap) < 0.15 ? 0 : Math.sign(gap);
        const option = options.find(o => o.turn === towards);
        if (option.free >= ai.look * 0.8) choice = option;
      }
    }
    s.ai.turn = choice.turn;
    s.turn = choice.turn;
  }

  /* ---------- Simulation ---------- */

  const speedOf = s => (rules.speed || 120) * Math.min(1.7, 1 + roundTime * 0.014) * s.slow;

  function kill(s) {
    s.alive = false;
    s.turn = 0;
    particles.burst(s.x, s.y, s.p.color, { count: 22, speed: 300, size: 9, life: 0.8 });
    particles.burst(s.x, s.y, "#ffffff", { count: 10, speed: 200, size: 6, life: 0.5 });
    play("wrong");
    padOf(s.seat)?.classList.add("out");
  }

  function paintTrail(s, x, y) {
    if (s.lx === null) { s.lx = x; s.ly = y; return; }
    tg.save();
    tg.scale(SHARP, SHARP);
    tg.strokeStyle = s.p.color;
    tg.lineWidth = R * 2;
    tg.lineCap = "round";
    tg.beginPath(); tg.moveTo(s.lx, s.ly); tg.lineTo(x, y); tg.stroke();
    tg.restore();
    s.lx = x; s.ly = y;
  }

  function moveSnake(s, dt) {
    const dist = speedOf(s) * dt;
    const steps = Math.max(1, Math.ceil(dist / 2));
    const sdt = dt / steps, sd = dist / steps;
    for (let k = 0; k < steps && s.alive; k++) {
      // Joystick : le serpent tourne vers la direction montrée par le doigt.
      if (s.aim !== null) { const gap = angleGap(s.aim, s.angle); s.angle += Math.sign(gap) * Math.min(Math.abs(gap), TURN * 1.15 * sdt); }
      else s.angle += s.turn * TURN * sdt;
      s.x += Math.cos(s.angle) * sd;
      s.y += Math.sin(s.angle) * sd;
      if (hits(s)) { kill(s); return; }
      const drawing = s.jump <= 0 && s.gap <= 0;
      if (drawing) { stamp(s.x, s.y, s.seat); paintTrail(s, s.x, s.y); }
      else { s.lx = null; }
      // Portails
      if (s.portalWait <= 0) {
        for (const pair of portals) {
          for (const [from, to] of [[pair.a, pair.b], [pair.b, pair.a]]) {
            if (Math.hypot(s.x - from.x, s.y - from.y) > PORTAL * 0.75) continue;
            s.x = to.x + Math.cos(s.angle) * (PORTAL + 4);
            s.y = to.y + Math.sin(s.angle) * (PORTAL + 4);
            s.lx = null;
            s.portalWait = 0.5;
            particles.burst(to.x, to.y, pair.color, { count: 14, speed: 200, size: 7, life: 0.5 });
            play("pop");
          }
        }
      }
    }
  }

  function placeApple() {
    for (let tries = 0; tries < 40; tries++) {
      const x = between(WALL + 70, FW - WALL - 70), y = between(WALL + 70, FH - WALL - 70);
      if (snakes.some(s => s.alive && Math.hypot(s.x - x, s.y - y) < 140)) continue;
      if (portals.some(p => Math.hypot(p.a.x - x, p.a.y - y) < 80 || Math.hypot(p.b.x - x, p.b.y - y) < 80)) continue;
      let free = true;
      for (let a = 0; a < 8 && free; a++) free = !blocked(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 255);
      if (!free || blocked(x, y, 255)) continue;
      apple = { x, y, t: 0 };
      return;
    }
  }

  function update(dt) {
    particles.update(dt);
    if (phase === "countdown") {
      const before = Math.ceil(timer);
      timer -= dt;
      if (Math.ceil(timer) !== before && timer > 0) play("tick");
      if (timer <= 0) { phase = "play"; play("go"); }
      return;
    }
    if (phase === "between" || phase === "done") {
      timer -= dt;
      if (phase === "between" && timer <= 0) { round++; setupRound(); }
      return;
    }
    roundTime += dt;
    clock += dt;
    if (rules.apples && !apple) {
      appleTimer -= dt;
      if (appleTimer <= 0) { placeApple(); appleTimer = between(4, 7); }
    }
    if (apple) apple.t += dt;
    for (const s of snakes) {
      if (!s.alive) continue;
      s.jump = Math.max(0, s.jump - dt);
      s.portalWait = Math.max(0, s.portalWait - dt);
      if (rules.gaps) {
        if (s.gap > 0) s.gap -= dt;
        else if ((s.gapTimer -= dt) <= 0) { s.gap = 0.2; s.gapTimer = between(2.5, 4.5); }
      }
      if (s.p.kind === "robot") think(s, dt);
    }
    for (const s of snakes) if (s.alive) moveSnake(s, dt);
    // Pomme mangée : le serpent saute.
    if (apple) {
      const eater = snakes.find(s => s.alive && Math.hypot(s.x - apple.x, s.y - apple.y) < 30);
      if (eater) {
        eater.jump = JUMP;
        particles.burst(apple.x, apple.y, "#FF5A5F", { count: 16, speed: 240, size: 8, life: 0.6 });
        apple = null;
        play("star");
      }
    }
    const alive = snakes.filter(s => s.alive);
    const humans = alive.filter(s => s.p.kind === "human");
    // Fin de manche : un seul serpent reste, ou plus aucun enfant n'est en jeu.
    if (alive.length <= 1 || !humans.length) endRound();
  }

  /* ---------- Dessin ---------- */

  function paintBoard() {
    const c = document.createElement("canvas");
    c.width = Math.round(FW * SHARP); c.height = Math.round(FH * SHARP);
    const b = c.getContext("2d");
    b.scale(SHARP, SHARP);
    b.fillStyle = "#1B2145";
    b.fillRect(0, 0, FW, FH);
    const floor = b.createRadialGradient(CX, CY, 100, CX, CY, Math.max(FW, FH) * 0.7);
    floor.addColorStop(0, "#34407A");
    floor.addColorStop(1, "#262F5E");
    b.fillStyle = floor;
    b.beginPath(); b.roundRect(WALL, WALL, FW - WALL * 2, FH - WALL * 2, 34); b.fill();
    b.fillStyle = "#ffffff16";
    for (let x = WALL + 25; x < FW - WALL; x += 50) {
      for (let y = WALL + 25; y < FH - WALL; y += 50) { b.beginPath(); b.arc(x, y, 2.6, 0, Math.PI * 2); b.fill(); }
    }
    b.strokeStyle = "#8F9BFF";
    b.lineWidth = 8;
    b.beginPath(); b.roundRect(WALL - 4, WALL - 4, FW - WALL * 2 + 8, FH - WALL * 2 + 8, 38); b.stroke();
    b.strokeStyle = "#ffffff33";
    b.lineWidth = 3;
    b.beginPath(); b.roundRect(WALL + 6, WALL + 6, FW - WALL * 2 - 12, FH - WALL * 2 - 12, 28); b.stroke();
    return c;
  }

  function drawPortal(p, color, t) {
    g.save();
    g.translate(p.x, p.y);
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, PORTAL + 14);
    glow.addColorStop(0, "#1B2145");
    glow.addColorStop(0.6, color + "aa");
    glow.addColorStop(1, color + "00");
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, PORTAL + 14, 0, Math.PI * 2); g.fill();
    g.rotate(t * 2.2);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.arc(0, 0, PORTAL - k * 8, k * 2, k * 2 + Math.PI * 1.2); g.stroke();
    }
    g.restore();
  }

  function drawApple(a) {
    const bob = Math.sin(a.t * 4) * 4;
    g.save();
    g.translate(a.x, a.y + bob);
    g.fillStyle = "#00000033";
    g.beginPath(); g.ellipse(0, 22 - bob, 16, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#FF5A5F";
    g.strokeStyle = INK;
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(-6, 2, 13, 0, Math.PI * 2); g.arc(6, 2, 13, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0, -9); g.bezierCurveTo(-22, -16, -24, 18, -2, 16); g.bezierCurveTo(0, 18, 0, 18, 2, 16); g.bezierCurveTo(24, 18, 22, -16, 0, -9); g.stroke();
    g.strokeStyle = "#7A4A2A"; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(2, -18); g.stroke();
    g.fillStyle = "#6CBF5A"; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(9, -17, 8, 4, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#ffffffaa";
    g.beginPath(); g.ellipse(-9, -2, 4, 6, 0.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawHead(s, t) {
    g.save();
    g.translate(s.x, s.y);
    const lift = s.jump > 0 ? 1 + Math.sin(Math.min(1, (JUMP - s.jump) / JUMP) * Math.PI) * 0.35 : 1;
    if (s.jump > 0) {
      g.fillStyle = "#00000044";
      g.beginPath(); g.ellipse(0, HEAD * 0.9, HEAD * 0.9, HEAD * 0.35, 0, 0, Math.PI * 2); g.fill();
    }
    g.scale(lift, lift);
    if (!s.alive) g.globalAlpha = 0.45;
    // Flèche de direction pendant le compte à rebours
    if (phase === "countdown") {
      g.save();
      g.rotate(s.angle);
      g.fillStyle = s.p.color;
      g.strokeStyle = "#fff";
      g.lineWidth = 3;
      const reach = HEAD + 14 + Math.sin(t * 6) * 4;
      g.beginPath(); g.moveTo(reach + 18, 0); g.lineTo(reach, -12); g.lineTo(reach, 12); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.fillStyle = s.p.soft;
    g.beginPath(); g.arc(0, 0, HEAD, 0, Math.PI * 2); g.fill();
    if (s.image.complete && s.image.naturalWidth) {
      g.save();
      g.beginPath(); g.arc(0, 0, HEAD - 2, 0, Math.PI * 2); g.clip();
      const size = HEAD * 2.3;
      g.drawImage(s.image, -size / 2, -size / 2 + HEAD * 0.08, size, size);
      g.restore();
    }
    g.strokeStyle = s.p.color;
    g.lineWidth = 4.5;
    g.beginPath(); g.arc(0, 0, HEAD, 0, Math.PI * 2); g.stroke();
    if (s.jump > 0) {
      g.strokeStyle = Math.floor(s.jump * 8) % 2 && s.jump < 0.4 ? "#FFC83D55" : "#FFC83D";
      g.lineWidth = 4;
      g.setLineDash([6, 6]);
      g.beginPath(); g.arc(0, 0, HEAD + 6, t * 3, t * 3 + Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  function draw() {
    const t = performance.now() / 1000;
    stage.begin();
    g.drawImage(board, 0, 0, FW, FH);
    portals.forEach(pair => { drawPortal(pair.a, pair.color, t); drawPortal(pair.b, pair.color, -t); });
    g.drawImage(trail, 0, 0, FW, FH);
    if (apple) drawApple(apple);
    for (const s of snakes) if (!s.alive) drawHead(s, t);
    for (const s of snakes) if (s.alive) drawHead(s, t);
    particles.draw(g);
    if (phase === "countdown") {
      const count = Math.ceil(timer);
      text(g, count > 3 ? "" : count > 0 ? String(count) : "", CX, CY, { size: 150, color: "#fff", stroke: INK });
    } else if (message && (phase === "between" || phase === "done")) {
      text(g, message, CX, CY, { size: message.length > 14 ? Math.min(60, FW / 13) : 90, color: "#fff", stroke: INK });
    }
  }

  const loop = createLoop(dt => { update(dt); draw(); });

  return {
    start() { setupRound(); loop.start(); },
    pause() {
      loop.stop();
      [...fingers.keys()].forEach(release);
      snakes.forEach(s => { if (s.p.kind === "human") { setKey(s.seat, -1, false); setKey(s.seat, 1, false); } });
    },
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
  const node = h(`<div class="sp-demo">
    <svg viewBox="0 0 220 140" aria-hidden="true">
      <rect x="4" y="4" width="212" height="132" rx="20" fill="#262F5E" stroke="#8F9BFF" stroke-width="5"/>
      <path class="sp-demo-red" d="M190 30 C 120 30, 120 110, 60 110" fill="none" stroke="#EB5757" stroke-width="7" stroke-linecap="round"/>
      <path class="sp-demo-blue" d="M30 40 C 80 40, 110 60, 110 120" fill="none" stroke="#2F80ED" stroke-width="7" stroke-linecap="round"/>
    </svg>
    <div class="sp-demo-joy"><i></i></div>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "serpentins",
  title: "Serpentins",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#DCD8FF", ink: "#3B2F8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="12" y="12" width="136" height="96" rx="18" fill="#2B3468" stroke="#8F9BFF" stroke-width="4"/>
    <path d="M30 90 C 30 50, 70 40, 80 62 S 120 80, 128 40" fill="none" stroke="#2F80ED" stroke-width="7" stroke-linecap="round"/>
    <path d="M132 92 C 110 96, 96 76, 70 84" fill="none" stroke="#EB5757" stroke-width="7" stroke-linecap="round"/>
    <circle cx="128" cy="38" r="9" fill="#DCE9FC" stroke="#2F80ED" stroke-width="4"/>
    <circle cx="68" cy="84" r="9" fill="#FCDEDE" stroke="#EB5757" stroke-width="4"/>
    <circle cx="50" cy="34" r="8" fill="#FF5A5F" stroke="#2B2350" stroke-width="2.5"/>
    <path d="M50 26 l2 -6" stroke="#7A4A2A" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Ton serpent avance tout seul et laisse une trace. Pose ton doigt sur l'écran et fais-le glisser vers où ton serpent doit aller. Ne touche ni les bords ni les traces ! Mange une pomme pour sauter par-dessus."
      : `Chaque serpent avance tout seul et laisse une trace. Pose ton doigt dans ta zone et fais-le glisser vers où ton serpent doit aller. Ne touche ni les bords ni les traces : le dernier serpent en vie gagne la manche. ${GOAL} manches pour gagner !`,
    demo
  },
  levels: LEVELS,
  mount
};
