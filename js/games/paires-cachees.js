// Paires cachées : le jeu de mémoire. Des cartes face cachée au milieu de l'écran ; on en retourne deux,
// et si elles sont pareilles on les garde et on rejoue. À plusieurs, chacun son tour, sur le même plateau.
// Plus tard dans les niveaux, deux cartes changent de place quand on se trompe.
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";

const THEMES = {
  animaux: ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🦉"],
  fruits: ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥝", "🍍", "🥥", "🍈", "🫐", "🥕"],
  // Des dessins qui se ressemblent : il faut bien regarder.
  pareils: ["🐶", "🐕", "🐱", "🐈", "🐭", "🐹", "🐰", "🐇", "🐻", "🐨", "🐸", "🐢", "🐠", "🐟", "🦋", "🐞"],
  melange: ["🚗", "🚀", "⚽", "🎈", "🌈", "⭐", "🌻", "🍦", "🎁", "🎸", "⏰", "🔑", "☀️", "🌙", "❄️", "🧩"]
};
const MULTI_PAIRS = 12;

// Niveaux solo : nombre de paires, dessins, cartes qui bougent, essais pour 1, 2, 3 étoiles.
const LEVELS = [
  { pairs: 4, theme: "animaux", swap: false, stars: [9, 7, 5], goal: "Retourne deux cartes. Si elles sont pareilles, tu les gardes !" },
  { pairs: 6, theme: "animaux", swap: false, stars: [14, 11, 8], goal: "Six paires d'animaux. Souviens-toi où ils se cachent !" },
  { pairs: 8, theme: "fruits", swap: false, stars: [19, 15, 11], goal: "Huit paires de fruits." },
  { pairs: 10, theme: "melange", swap: false, stars: [24, 19, 14], goal: "Dix paires. Ta mémoire va travailler !" },
  { pairs: 8, theme: "animaux", swap: true, stars: [21, 17, 13], goal: "Attention : quand tu te trompes, deux cartes changent de place !" },
  { pairs: 12, theme: "fruits", swap: false, stars: [30, 24, 18], goal: "Douze paires de fruits." },
  { pairs: 10, theme: "pareils", swap: false, stars: [26, 21, 16], goal: "Des animaux qui se ressemblent : regarde bien les détails !" },
  { pairs: 12, theme: "melange", swap: true, stars: [32, 26, 20], goal: "Douze paires, et les cartes bougent !" },
  { pairs: 15, theme: "animaux", swap: false, stars: [38, 31, 24], goal: "Quinze paires ! Prends ton temps." },
  { pairs: 15, theme: "pareils", swap: true, stars: [40, 33, 26], goal: "Le défi des champions : quinze paires qui se ressemblent et qui bougent !" }
];
const FREE = { pairs: 12, theme: "melange", swap: true, stars: [32, 26, 20] };
// Chance de se souvenir d'une carte déjà vue.
const ROBOT = { 1: 0.35, 2: 0.65, 3: 0.9 };

const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : { pairs: MULTI_PAIRS, theme: pickOne(["animaux", "fruits", "melange"]), swap: false };
  const players = ctx.seats;
  const N = players.length;
  const scores = players.map(() => 0);
  let tries = 0;

  const faces = shuffle(THEMES[rules.theme]).slice(0, rules.pairs);
  let deck = shuffle([...faces, ...faces]).map((face, id) => ({ id, face, found: false, up: false }));

  const node = h(`<div class="pm n${N} ${solo ? "solo" : ""}">
    <div class="pm-board"></div>
    <div class="pads">${players.map((p, i) => `
      <div class="pad pm-pad pad-${i}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="pad-inner"><div class="pad-info"><span class="pad-avatar">${p.art}</span><span class="pm-count"></span></div></div>
      </div>`).join("")}
    </div>
    <div class="pm-turn"></div>
  </div>`);
  root.append(node);
  const board = node.querySelector(".pm-board");
  const banner = node.querySelector(".pm-turn");
  const padOf = i => node.querySelector(`.pad-${i}`);

  let turn = 0, picked = [], busy = false, phase = "play", clock = 0, events = [], robotWait = 0;
  // Ce que les robots ont vu : position → dessin.
  const seen = new Map();
  const after = (delay, fn) => events.push({ time: clock + delay, fn });

  function render() {
    board.innerHTML = deck.map((card, k) => `<button class="pm-card ${card.found ? "found" : ""} ${card.up || card.found ? "up" : ""}" data-k="${k}" aria-label="Carte ${k + 1}">
      <span class="pm-back"></span><span class="pm-face">${card.face}</span></button>`).join("");
    layout();
  }

  // Choisit le nombre de colonnes qui donne les plus grandes cartes.
  function layout() {
    const box = board.getBoundingClientRect();
    const n = deck.length, gap = 8;
    let best = { size: 0, cols: 4 };
    for (let cols = 2; cols <= 10; cols++) {
      const rows = Math.ceil(n / cols);
      const size = Math.min((box.width - gap * (cols - 1)) / cols, (box.height - gap * (rows - 1)) / rows / 1.2);
      if (size > best.size) best = { size, cols };
    }
    board.style.setProperty("--cols", best.cols);
    board.style.setProperty("--card", `${Math.max(30, Math.floor(best.size))}px`);
  }

  function renderPads() {
    players.forEach((p, i) => {
      const pad = padOf(i);
      pad.classList.toggle("turn", !solo && i === turn && phase === "play");
      pad.querySelector(".pm-count").textContent = solo ? `${tries} essai${tries > 1 ? "s" : ""}` : `${scores[i]} paire${scores[i] > 1 ? "s" : ""}`;
    });
    if (!solo && phase === "play") {
      const p = players[turn];
      banner.innerHTML = `<span class="pm-turn-art">${p.art}</span> À ${p.label} !`;
      banner.style.setProperty("--seat", p.color);
      banner.className = `pm-turn show pos-${turn}`;
    }
  }

  function cardEl(k) { return board.querySelector(`[data-k="${k}"]`); }

  function flip(k) {
    const card = deck[k];
    if (phase !== "play" || busy || card.found || card.up || picked.length >= 2) return;
    card.up = true;
    cardEl(k)?.classList.add("up");
    picked.push(k);
    seen.set(k, card.face);
    play("tap");
    if (picked.length === 2) check();
  }

  function check() {
    busy = true;
    tries++;
    const [a, b] = picked;
    if (deck[a].face === deck[b].face) {
      after(0.45, () => {
        deck[a].found = deck[b].found = true;
        cardEl(a)?.classList.add("found"); cardEl(b)?.classList.add("found");
        seen.delete(a); seen.delete(b);
        scores[turn]++;
        picked = []; busy = false;
        play("point");
        renderPads();
        if (deck.every(c => c.found)) return after(0.7, finish);
        robotWait = clock + 0.8;
      });
    } else {
      after(1.15, () => {
        deck[a].up = deck[b].up = false;
        cardEl(a)?.classList.remove("up"); cardEl(b)?.classList.remove("up");
        picked = []; busy = false;
        play("wrong");
        if (rules.swap) swapTwo();
        if (!solo) turn = nextPlayer();
        renderPads();
        robotWait = clock + 1;
      });
    }
    renderPads();
  }

  // Deux cartes cachées changent de place, sous les yeux des joueurs.
  function swapTwo() {
    const hidden = deck.map((c, k) => k).filter(k => !deck[k].found);
    if (hidden.length < 3) return;
    const [a, b] = shuffle(hidden);
    [deck[a].face, deck[b].face] = [deck[b].face, deck[a].face];
    // Ce qu'on avait vu de ces deux cartes s'échange aussi (un bon joueur le suit des yeux).
    const sa = seen.get(a), sb = seen.get(b);
    seen.delete(a); seen.delete(b);
    if (sb) seen.set(a, sb);
    if (sa) seen.set(b, sa);
    cardEl(a).querySelector(".pm-face").textContent = deck[a].face;
    cardEl(b).querySelector(".pm-face").textContent = deck[b].face;
    [cardEl(a), cardEl(b)].forEach(el => { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); });
    play("trap");
  }

  const nextPlayer = () => (turn + 1) % N;

  // Le robot retourne deux cartes, avec la mémoire de sa force.
  function robotPlay() {
    const memory = ROBOT[players[turn].level] || ROBOT[2];
    const known = [...seen.entries()].filter(([k]) => !deck[k].found && !deck[k].up && Math.random() < memory);
    const hidden = deck.map((c, k) => k).filter(k => !deck[k].found && !deck[k].up);
    if (!picked.length) {
      // Une paire connue ?
      for (const [k, face] of known) {
        const twin = known.find(([j, f]) => j !== k && f === face);
        if (twin) { flip(k); robotWait = clock + 0.8; return; }
      }
      const unknown = hidden.filter(k => !seen.has(k));
      flip(pickOne(unknown.length ? unknown : hidden));
      robotWait = clock + 0.8;
      return;
    }
    const first = deck[picked[0]];
    const twin = known.find(([k, f]) => k !== picked[0] && f === first.face);
    const choices = hidden.filter(k => k !== picked[0]);
    const unknown = choices.filter(k => !seen.has(k));
    flip(twin ? twin[0] : pickOne(unknown.length ? unknown : choices));
  }

  function finish() {
    phase = "done";
    banner.className = "pm-turn";
    if (solo) {
      const stars = rules.stars.filter(limit => tries <= limit).length;
      ctx.finish({
        solo: {
          stars, value: tries, lowerIsBetter: true,
          format: v => `${v} essais`,
          label: `${rules.pairs} paires en ${tries} essais`,
          speech: stars === 3 ? "Quelle mémoire d'éléphant !" : `Toutes les paires en ${tries} essais !`,
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : ${rules.stars[stars]} essais au plus`
        }
      });
      return;
    }
    ctx.finish({ ranking: scores.map((score, seat) => ({ seat, score, label: `${score} paire${score > 1 ? "s" : ""}` })) });
  }

  const onDown = event => {
    const button = event.target.closest(".pm-card");
    if (!button || players[turn].kind !== "human") return;
    event.preventDefault();
    flip(Number(button.dataset.k));
  };
  node.addEventListener("pointerdown", onDown);
  const onResize = () => layout();
  window.addEventListener("resize", onResize);

  const loop = createLoop(dt => {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    if (phase === "play" && !busy && players[turn].kind === "robot" && clock >= robotWait) robotPlay();
  });

  return {
    start() {
      render();
      renderPads();
      robotWait = 1.2;
      say(solo ? "Retrouve toutes les paires !" : `À ${players[0].label} de commencer !`);
      loop.start();
      requestAnimationFrame(layout);
    },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); window.removeEventListener("resize", onResize); }
  };
}

function demo() {
  const node = h(`<div class="pm-demo">
    <span class="pm-demo-card a">🐶</span><span class="pm-demo-card"></span><span class="pm-demo-card b">🐶</span><span class="pm-demo-card"></span>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "paires-cachees",
  title: "Paires cachées",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFE6F0", ink: "#8A2B5A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    ${[0, 1, 2, 3].map(c => [0, 1].map(r => `<rect x="${14 + c * 34}" y="${16 + r * 46}" width="28" height="38" rx="6" fill="${(c === 1 && r === 0) || (c === 3 && r === 1) ? "#fff" : "#B983FF"}" stroke="#2B2350" stroke-width="2.5"/>`).join("")).join("")}
    <text x="54" y="44" font-size="18" text-anchor="middle">🐶</text><text x="122" y="90" font-size="18" text-anchor="middle">🐶</text>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Retourne deux cartes. Si elles sont pareilles, tu les gardes ! Retrouve toutes les paires avec le moins d'essais possible."
      : "Chacun son tour : retourne deux cartes. Si elles sont pareilles, tu les gardes et tu rejoues ! Sinon, c'est au suivant. Celui qui a le plus de paires gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
