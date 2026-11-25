// Quatre à la suite : chacun son tour, on lâche un jeton en haut d'une colonne ; il tombe tout en bas.
// Le premier qui aligne quatre jetons (debout, couché ou en biais) gagne la manche.
// Seul contre un robot qui réfléchit plus ou moins loin, ou à deux.
import { SEATS, robotArt } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";

const MULTI_GOAL = 2;            // manches gagnées pour remporter la partie à deux
const SOLO_GAMES = 3;            // parties par niveau solo

// Niveaux solo : taille de la grille, force du robot (coups d'avance), maladresse, qui commence.
const LEVELS = [
  { cols: 7, rows: 6, depth: 0, blunder: 0.6, robotFirst: false, goal: "Lâche tes jetons dans les colonnes. Aligne-en quatre avant le robot !" },
  { cols: 7, rows: 6, depth: 1, blunder: 0.4, robotFirst: false, goal: "Le robot essaie de t'empêcher de gagner. Regarde bien ses jetons aussi !" },
  { cols: 7, rows: 6, depth: 2, blunder: 0.25, robotFirst: false, goal: "Un robot qui réfléchit un coup d'avance." },
  { cols: 7, rows: 6, depth: 2, blunder: 0.2, robotFirst: true, goal: "Cette fois, le robot commence !" },
  { cols: 7, rows: 6, depth: 3, blunder: 0.12, robotFirst: false, goal: "Le robot devient malin. Prépare deux menaces à la fois !" },
  { cols: 8, rows: 7, depth: 3, blunder: 0.1, robotFirst: false, goal: "Une grille plus grande : plus de place pour les pièges." },
  { cols: 7, rows: 6, depth: 4, blunder: 0.06, robotFirst: true, goal: "Le robot fort commence. Défends-toi bien !" },
  { cols: 6, rows: 5, depth: 4, blunder: 0.05, robotFirst: false, goal: "Une petite grille : tout va très vite !" },
  { cols: 7, rows: 6, depth: 5, blunder: 0.03, robotFirst: false, goal: "Presque le champion des robots." },
  { cols: 7, rows: 6, depth: 6, blunder: 0, robotFirst: true, goal: "Le défi des champions : le robot qui voit le plus loin !" }
];
const FREE = { cols: 7, rows: 6, depth: 4, blunder: 0.05, robotFirst: false };
const ROBOT = { 1: { depth: 1, blunder: 0.35 }, 2: { depth: 3, blunder: 0.1 }, 3: { depth: 5, blunder: 0.02 } };

const between = (a, b) => a + Math.random() * (b - a);

/* ---------- Règles et robot ---------- */

function winnerAt(grid, cols, rows) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = grid[r][c];
    if (v < 0) continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [[r, c]];
      for (let k = 1; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || grid[rr][cc] !== v) break;
        cells.push([rr, cc]);
      }
      if (cells.length === 4) return { who: v, cells };
    }
  }
  return null;
}

// Ligne où tombe un jeton dans la colonne c (la ligne 0 est en haut), ou -1 si elle est pleine.
const landing = (grid, c) => { for (let r = grid.length - 1; r >= 0; r--) if (grid[r][c] < 0) return r; return -1; };

// Score d'une position pour le joueur `me` : on compte les alignements encore possibles.
function evaluate(grid, me, cols, rows) {
  let score = 0;
  const center = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) if (grid[r][center] === me) score += 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let mine = 0, theirs = 0, ok = true;
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) { ok = false; break; }
        const v = grid[rr][cc];
        if (v === me) mine++; else if (v >= 0) theirs++;
      }
      if (!ok || (mine && theirs)) continue;
      if (mine === 3) score += 12; else if (mine === 2) score += 4;
      if (theirs === 3) score -= 14; else if (theirs === 2) score -= 4;
    }
  }
  return score;
}

function negamax(grid, depth, me, alpha, beta, cols, rows) {
  const won = winnerAt(grid, cols, rows);
  if (won) return won.who === me ? 10000 + depth : -10000 - depth;
  const moves = order(cols).filter(c => landing(grid, c) >= 0);
  if (!moves.length) return 0;
  if (depth === 0) return evaluate(grid, me, cols, rows);
  let best = -Infinity;
  for (const c of moves) {
    const r = landing(grid, c);
    grid[r][c] = me;
    const value = -negamax(grid, depth - 1, 1 - me, -beta, -alpha, cols, rows);
    grid[r][c] = -1;
    best = Math.max(best, value);
    alpha = Math.max(alpha, value);
    if (alpha >= beta) break;
  }
  return best;
}
// On essaie d'abord les colonnes du milieu (meilleurs coups en général, recherche plus rapide).
const order = cols => Array.from({ length: cols }, (_, i) => i).sort((a, b) => Math.abs(a - (cols - 1) / 2) - Math.abs(b - (cols - 1) / 2));

function robotMove(grid, me, depth, blunder, cols, rows) {
  const moves = order(cols).filter(c => landing(grid, c) >= 0);
  // Un robot maladroit joue parfois n'importe où (mais il gagne toujours s'il le peut).
  const winNow = moves.find(c => { const r = landing(grid, c); grid[r][c] = me; const w = winnerAt(grid, cols, rows); grid[r][c] = -1; return w; });
  if (winNow !== undefined) return winNow;
  if (Math.random() < blunder) return moves[Math.floor(Math.random() * moves.length)];
  if (depth === 0) return moves[Math.floor(Math.random() * moves.length)];
  let best = -Infinity, choice = moves[0];
  for (const c of moves) {
    const r = landing(grid, c);
    grid[r][c] = me;
    const value = -negamax(grid, depth - 1, 1 - me, -Infinity, Infinity, cols, rows) + between(0, 0.5);
    grid[r][c] = -1;
    if (value > best) { best = value; choice = c; }
  }
  return choice;
}

/* ---------- Le jeu ---------- */

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const setup = solo ? (level || FREE) : { cols: 7, rows: 6 };
  const { cols, rows } = setup;
  const players = solo
    ? [ctx.seats[0], { ...SEATS[1], kind: "robot", level: 2, label: "Robot", art: robotArt(setup.depth >= 5 ? 3 : setup.depth >= 2 ? 2 : 1), boost: 0, index: 1 }]
    : ctx.seats;
  const wins = [0, 0];
  let game = 0, draws = 0;

  const node = h(`<div class="q4">
    ${players.map((p, i) => `<div class="q4-player p${i}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
      <span class="q4-avatar">${p.art}</span><span class="q4-name">${p.label}</span><span class="q4-token"></span><span class="q4-wins"></span></div>`).join("")}
    <div class="q4-board" style="--cols:${cols};--rows:${rows}">
      <div class="q4-drops"></div>
      <div class="q4-grid">${Array.from({ length: rows * cols }, (_, k) => `<span class="q4-hole" data-c="${k % cols}"></span>`).join("")}</div>
    </div>
    <div class="q4-msg"></div>
  </div>`);
  root.append(node);
  const drops = node.querySelector(".q4-drops");
  const gridEl = node.querySelector(".q4-grid");
  const msg = node.querySelector(".q4-msg");

  let grid, turn, phase = "play", clock = 0, events = [], robotAt = 0;
  const after = (delay, fn) => events.push({ time: clock + delay, fn });

  function newGame() {
    grid = Array.from({ length: rows }, () => Array(cols).fill(-1));
    drops.innerHTML = "";
    gridEl.querySelectorAll(".q4-hole").forEach(h => h.classList.remove("win"));
    // Chacun commence à son tour ; en solo, le niveau dit qui commence la première partie.
    const robotFirst = solo && (setup.robotFirst ? game % 2 === 0 : game % 2 === 1);
    turn = solo ? (robotFirst ? 1 : 0) : game % 2;
    phase = "play";
    robotAt = clock + 0.9;
    showTurn();
  }

  function showTurn() {
    node.querySelectorAll(".q4-player").forEach((el, i) => {
      el.classList.toggle("turn", i === turn && phase === "play");
      el.querySelector(".q4-wins").textContent = solo ? `${wins[i]}` : `${wins[i]} / ${MULTI_GOAL}`;
    });
    msg.textContent = phase === "play" ? (players[turn].kind === "robot" ? "Le robot réfléchit…" : `À ${players[turn].label} !`) : msg.textContent;
    msg.style.setProperty("--seat", players[turn].color);
  }

  function drop(c) {
    if (phase !== "play") return;
    const r = landing(grid, c);
    if (r < 0) { play("wrong"); return; }
    grid[r][c] = turn;
    phase = "falling";
    const token = h(`<span class="q4-chip" style="--seat:${players[turn].color};--seat-deep:${players[turn].deep};--c:${c};--r:${r}"></span>`);
    drops.append(token);
    void token.offsetWidth;   // position de départ prise en compte avant la chute
    token.classList.add("down");
    play("pop");
    after(0.45, () => {
      play("tap");
      const won = winnerAt(grid, cols, rows);
      if (won) return endGame(won);
      if (grid[0].every(v => v >= 0)) return endGame(null);
      turn = 1 - turn;
      phase = "play";
      robotAt = clock + between(0.5, 0.9);
      showTurn();
    });
  }

  function endGame(won) {
    phase = "between";
    node.querySelectorAll(".q4-player").forEach(el => el.classList.remove("turn"));
    if (won) {
      wins[won.who]++;
      won.cells.forEach(([r, c]) => gridEl.children[r * cols + c].classList.add("win"));
      drops.querySelectorAll(".q4-chip").forEach(chip => {
        const r = Number(chip.style.getPropertyValue("--r")), c = Number(chip.style.getPropertyValue("--c"));
        if (won.cells.some(([rr, cc]) => rr === r && cc === c)) chip.classList.add("win");
      });
      msg.textContent = solo ? (won.who === 0 ? "Quatre à la suite ! Gagné !" : "Le robot a aligné quatre jetons !") : `${players[won.who].label} gagne la manche !`;
      msg.style.setProperty("--seat", players[won.who].color);
      play(solo && won.who === 1 ? "trap" : "win");
    } else {
      draws++;
      msg.textContent = "Grille pleine : égalité !";
      play("point");
    }
    showTurn();
    game++;
    const over = solo ? game >= SOLO_GAMES : wins.some(w => w >= MULTI_GOAL);
    after(2.4, () => over ? finish() : newGame());
  }

  function finish() {
    phase = "done";
    if (solo) {
      const stars = wins[0];
      ctx.finish({
        solo: {
          stars, value: wins[0], lowerIsBetter: false,
          format: v => `${v} partie${v > 1 ? "s" : ""} gagnée${v > 1 ? "s" : ""}`,
          label: `${wins[0]} partie${wins[0] > 1 ? "s" : ""} gagnée${wins[0] > 1 ? "s" : ""} sur ${SOLO_GAMES}`,
          speech: wins[0] ? `Tu as gagné ${wins[0]} partie${wins[0] > 1 ? "s" : ""} !` : "Le robot était coriace !",
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : gagner ${stars + 1} partie${stars ? "s" : ""}`
        }
      });
      return;
    }
    ctx.finish({ ranking: wins.map((score, seat) => ({ seat, score, label: `${score} manche${score > 1 ? "s" : ""}` })) });
  }

  const onDown = event => {
    const hole = event.target.closest(".q4-hole, .q4-board");
    if (!hole || phase !== "play" || players[turn].kind !== "human") return;
    event.preventDefault();
    // Colonne touchée : d'après la position du doigt sur la grille.
    const box = gridEl.getBoundingClientRect();
    const c = Math.floor((event.clientX - box.left) / box.width * cols);
    if (c >= 0 && c < cols) drop(c);
  };
  node.addEventListener("pointerdown", onDown);

  const loop = createLoop(dt => {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    if (phase === "play" && players[turn].kind === "robot" && clock >= robotAt) {
      const brain = solo ? { depth: setup.depth, blunder: setup.blunder } : ROBOT[players[turn].level] || ROBOT[2];
      drop(robotMove(grid, turn, brain.depth, brain.blunder, cols, rows));
    }
  });

  return {
    start() { newGame(); loop.start(); say(solo ? "Aligne quatre jetons avant le robot !" : "Aligne quatre jetons de ta couleur !"); },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); }
  };
}

function demo() {
  const node = h(`<div class="q4-demo">${Array.from({ length: 20 }, (_, k) => `<span class="${[16, 17, 18].includes(k) ? "b" : [12, 13].includes(k) ? "r" : ""}"></span>`).join("")}<i class="q4-demo-drop"></i></div>`);
  return { node, stop() {} };
}

export default {
  id: "quatre-a-la-suite",
  title: "Quatre à la suite",
  players: { min: 1, max: 2 },
  robots: true,
  theme: { bg: "#E6E9FF", ink: "#3B2F8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="20" y="14" width="120" height="96" rx="12" fill="#4D63D6" stroke="#2B2350" stroke-width="4"/>
    ${Array.from({ length: 20 }, (_, k) => { const c = k % 5, r = Math.floor(k / 5); const fill = r === 3 && c < 4 ? "#F2C94C" : (r === 2 && c < 2) || (r === 3 && c === 4) ? "#EB5757" : "#E9F0FF"; return `<circle cx="${38 + c * 21}" cy="${32 + r * 21}" r="8" fill="${fill}"/>`; }).join("")}
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Touche une colonne pour y lâcher ton jeton. Aligne quatre jetons, debout, couché ou en biais, avant le robot ! Trois parties par niveau."
      : `Chacun son tour, touche une colonne pour y lâcher ton jeton. Le premier qui aligne quatre jetons gagne la manche. ${MULTI_GOAL} manches pour gagner !`,
    demo
  },
  levels: LEVELS,
  mount
};
