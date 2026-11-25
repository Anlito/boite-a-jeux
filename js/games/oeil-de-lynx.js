// Œil de lynx : une grande carte au milieu, une carte pour chaque joueur. Deux cartes ont toujours
// un seul dessin en commun : le premier qui le touche sur sa carte marque le point.
// Les cartes sont construites comme un plan projectif : chaque paire de cartes partage exactement un dessin.
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";

const GOAL = 6;                  // points pour gagner à plusieurs
const MULTI_ORDER = 3;           // à plusieurs : 4 dessins par carte
const SYMBOLS = ["🐶", "🐱", "🍎", "⭐", "🚗", "🌈", "⚽", "🎈", "🦋", "🌻", "🍌", "🐸", "🐟", "🍓", "🚀", "🎁",
  "🔑", "☀️", "🌙", "❄️", "🔥", "🍦", "🐢", "🦁", "🐘", "🍄", "⚓", "🎸", "✏️", "⏰", "🧩"];

// Niveaux solo : dessins par carte (ordre 2 = 3 dessins, 3 = 4, 5 = 6), nombre de cartes,
// dessins tournés et de tailles variées, temps (secondes) pour 1, 2, 3 étoiles.
const LEVELS = [
  { order: 2, cards: 8, turn: false, sizes: false, stars: [45, 30, 20], goal: "Trouve le dessin qui est aussi sur la grande carte, et touche-le sur ta carte !" },
  { order: 2, cards: 10, turn: true, sizes: false, stars: [50, 35, 24], goal: "Les dessins sont tournés dans tous les sens. Ouvre l'œil !" },
  { order: 3, cards: 8, turn: false, sizes: false, stars: [55, 38, 26], goal: "Quatre dessins par carte maintenant." },
  { order: 3, cards: 10, turn: true, sizes: false, stars: [60, 42, 30], goal: "Quatre dessins, tournés dans tous les sens." },
  { order: 3, cards: 12, turn: true, sizes: true, stars: [70, 50, 36], goal: "Des petits et des grands dessins : la taille ne compte pas !" },
  { order: 5, cards: 8, turn: false, sizes: false, stars: [70, 50, 36], goal: "Six dessins par carte ! Prends ton temps." },
  { order: 5, cards: 10, turn: true, sizes: false, stars: [80, 58, 42], goal: "Six dessins tournés. Un seul est sur les deux cartes." },
  { order: 5, cards: 12, turn: true, sizes: true, stars: [90, 66, 48], goal: "Six dessins de toutes les tailles." },
  { order: 5, cards: 15, turn: true, sizes: true, stars: [110, 80, 60], goal: "Quinze cartes : un vrai œil de lynx !" },
  { order: 5, cards: 20, turn: true, sizes: true, stars: [140, 100, 76], goal: "Le défi des champions : vingt cartes !" }
];
const FREE = { order: 5, cards: 15, turn: true, sizes: true, stars: [110, 80, 60] };
const ROBOT = {
  1: { time: [3.8, 6.5], right: 0.8 },
  2: { time: [2.4, 4.2], right: 0.9 },
  3: { time: [1.4, 2.6], right: 0.96 }
};
const PENALTY = 2;               // secondes ajoutées en solo pour une erreur

const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

// Toutes les cartes d'un plan projectif d'ordre n (n premier) : n² + n + 1 cartes de n + 1 dessins.
function deck(n) {
  const point = (x, y) => x * n + y;           // points ordinaires
  const slope = m => n * n + m;                // points à l'infini
  const inf = n * n + n;
  const lines = [];
  for (let m = 0; m < n; m++) for (let b = 0; b < n; b++) {
    const line = [slope(m)];
    for (let x = 0; x < n; x++) line.push(point(x, (m * x + b) % n));
    lines.push(line);
  }
  for (let c = 0; c < n; c++) {
    const line = [inf];
    for (let y = 0; y < n; y++) line.push(point(c, y));
    lines.push(line);
  }
  lines.push([...Array.from({ length: n }, (_, m) => slope(m)), inf]);
  // On associe chaque point à un dessin, mélangés à chaque partie.
  const symbols = shuffle(SYMBOLS).slice(0, n * n + n + 1);
  return lines.map(line => line.map(p => symbols[p]));
}

const common = (a, b) => a.find(s => b.includes(s));

// Places des dessins sur une carte ronde (en % du diamètre).
const SLOTS = {
  3: [[50, 27], [27, 66], [73, 66]],
  4: [[50, 24], [24, 50], [76, 50], [50, 76]],
  6: [[50, 50], [50, 18], [80, 40], [69, 77], [31, 77], [20, 40]]
};

function cardHTML(symbols, rules, kind) {
  const slots = SLOTS[symbols.length];
  return `<div class="ol-card ${kind}">${shuffle(symbols).map((s, k) => {
    const [x, y] = slots[k];
    const turn = rules.turn ? Math.round(between(0, 360)) : 0;
    const size = rules.sizes ? between(0.75, 1.25) : 1;
    return `<button class="ol-sym" data-s="${s}" style="left:${x}%;top:${y}%;--r:${turn}deg;--k:${size.toFixed(2)}">${s}</button>`;
  }).join("")}</div>`;
}

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : { order: MULTI_ORDER, turn: true, sizes: false };
  const players = ctx.seats;
  const N = players.length;
  const cards = deck(rules.order);
  const scores = players.map(() => 0);
  const total = solo ? rules.cards : Infinity;
  let done = 0, mistakes = 0;

  const node = h(`<div class="ol n${N}">
    <div class="ol-center"></div>
    ${players.map((p, i) => `
      <section class="ol-zone pos-${i} ${p.kind} ${(N === 2 && i === 1) || (N >= 3 && (i === 1 || i === 3)) ? "top" : ""}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="ol-inner">
          <div class="ol-space"></div>
          <div class="ol-mine"></div>
          <div class="ol-head"><span class="ol-avatar">${p.art}</span><span class="ol-name">${p.label}</span><span class="ol-score"></span></div>
        </div>
      </section>`).join("")}
  </div>`);
  root.append(node);
  const center = node.querySelector(".ol-center");
  const zones = [...node.querySelectorAll(".ol-zone")];
  const mine = i => zones[i].querySelector(".ol-mine");

  let clock = 0, events = [], phase = "intro", centerCard = null, hands = [], locked = [], robotAt = [], startedAt = 0;
  const after = (delay, fn) => events.push({ time: clock + delay, fn });

  function renderScores() {
    zones.forEach((z, i) => {
      z.querySelector(".ol-score").textContent = solo ? `${Math.min(done + 1, total)} / ${total}` : `${scores[i]} / ${GOAL}`;
    });
  }

  function deal() {
    phase = "play";
    const pool = shuffle(cards);
    centerCard = pool[0];
    hands = players.map((_, i) => pool[i + 1]);
    locked = players.map(() => 0);
    robotAt = players.map(p => p.kind === "robot" ? clock + between(...(ROBOT[p.level] || ROBOT[2]).time) : Infinity);
    center.innerHTML = cardHTML(centerCard, rules, "big");
    players.forEach((_, i) => {
      mine(i).innerHTML = cardHTML(hands[i], rules, "small");
      zones[i].classList.remove("won", "locked");
    });
    play("pop");
  }

  function tap(i, symbol, button) {
    if (phase !== "play" || clock < locked[i]) return;
    const right = common(hands[i], centerCard);
    if (symbol === right) {
      phase = "reveal";
      button?.classList.add("good");
      center.querySelector(`.ol-sym[data-s="${right}"]`)?.classList.add("good");
      zones[i].classList.add("won");
      play("point");
      if (solo) done++;
      else scores[i]++;
      renderScores();
      if (solo ? done >= total : scores[i] >= GOAL) return after(0.9, finish);
      after(solo ? 0.6 : 1.1, deal);
    } else {
      locked[i] = clock + (solo ? 0.8 : 1.3);
      if (solo) { mistakes++; startedAt -= PENALTY; }
      button?.classList.add("bad");
      zones[i].classList.add("locked");
      setTimeout(() => { button?.classList.remove("bad"); zones[i].classList.remove("locked"); }, solo ? 800 : 1300);
      play("wrong");
    }
  }

  function finish() {
    phase = "done";
    if (solo) {
      const time = Math.round((clock - startedAt) * 10) / 10;
      const stars = rules.stars.filter(limit => time <= limit).length;
      const fmt = v => `${String(v).replace(".", ",")} s`;
      ctx.finish({
        solo: {
          stars, value: time, lowerIsBetter: true,
          format: fmt,
          label: `${total} cartes en ${fmt(time)}${mistakes ? ` · ${mistakes} erreur${mistakes > 1 ? "s" : ""}` : ""}`,
          speech: stars === 3 ? "Quel œil de lynx !" : `${total} cartes en ${Math.round(time)} secondes !`,
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : moins de ${rules.stars[stars]} secondes`
        }
      });
      return;
    }
    ctx.finish({ ranking: scores.map((score, seat) => ({ seat, score, label: `${score} point${score > 1 ? "s" : ""}` })) });
  }

  const onDown = event => {
    const button = event.target.closest(".ol-mine .ol-sym");
    if (!button) return;
    const i = zones.findIndex(z => z.contains(button));
    if (i < 0 || players[i].kind !== "human") return;
    event.preventDefault();
    tap(i, button.dataset.s, button);
  };
  node.addEventListener("pointerdown", onDown);

  function update(dt) {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    if (phase !== "play") return;
    players.forEach((p, i) => {
      if (p.kind !== "robot" || clock < robotAt[i] || clock < locked[i]) return;
      const brain = ROBOT[p.level] || ROBOT[2];
      const right = common(hands[i], centerCard);
      const choice = Math.random() < brain.right ? right : pickOne(hands[i].filter(s => s !== right));
      robotAt[i] = clock + between(...brain.time) * 0.6;
      tap(i, choice, mine(i).querySelector(`.ol-sym[data-s="${choice}"]`));
    });
    if (solo && phase === "play") zones[0].querySelector(".ol-score").textContent = `${done + 1} / ${total} · ${Math.floor(clock - startedAt)} s`;
  }

  const loop = createLoop(update);

  return {
    start() {
      renderScores();
      say(solo ? "Trouve le dessin commun !" : "Le plus rapide marque !");
      after(0.8, () => { startedAt = clock; deal(); });
      loop.start();
    },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); }
  };
}

function demo() {
  const node = h(`<div class="ol-demo">
    <div class="ol-demo-card"><span>🐶</span><span>⭐</span><span class="yes">🍎</span></div>
    <div class="ol-demo-card"><span class="yes">🍎</span><span>🚀</span><span>🌻</span></div>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "oeil-de-lynx",
  title: "Œil de lynx",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#E3F4FF", ink: "#1F5C8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <circle cx="56" cy="60" r="40" fill="#fff" stroke="#2B2350" stroke-width="3"/>
    <circle cx="112" cy="64" r="34" fill="#fff" stroke="#2B2350" stroke-width="3"/>
    <text x="44" y="50" font-size="22">🐶</text><text x="56" y="84" font-size="22">⭐</text><text x="30" y="80" font-size="18">🍓</text>
    <text x="100" y="58" font-size="22">⭐</text><text x="110" y="88" font-size="18">🚀</text>
    <circle cx="68" cy="77" r="15" fill="none" stroke="#27AE60" stroke-width="3"/><circle cx="112" cy="51" r="15" fill="none" stroke="#27AE60" stroke-width="3"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Ta carte et la grande carte ont un seul dessin en commun. Trouve-le et touche-le sur ta carte, le plus vite possible !"
      : `Chaque carte a un seul dessin en commun avec la grande carte du milieu. Le premier qui le touche sur sa carte marque un point. Attention, une erreur et tu attends un peu ! ${GOAL} points pour gagner.`,
    demo
  },
  levels: LEVELS,
  mount
};
