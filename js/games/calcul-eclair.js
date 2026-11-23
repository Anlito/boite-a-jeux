// Calcul-éclair : un calcul s'affiche dans chaque zone, adapté au niveau de chacun (du « petit »
// qui compte jusqu'à 10 au CE2). On touche la bonne réponse parmi quatre ; le plus rapide marque.
// En solo : des séries de calculs contre la montre.
// Les calculs restent simples : additions, soustractions, tables de 2 et de 3.
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";

const GOAL = 7;                  // points pour gagner à plusieurs
const ROUND_TIME = 12;           // secondes pour répondre à plusieurs
const MEMORY = "boite-a-jeux.calcul";   // dernier niveau choisi par chaque enfant

const GRADES = [
  { id: "petit", label: "Petit", sub: "+ jusqu'à 10" },
  { id: "cp", label: "CP", sub: "+ et − jusqu'à 20" },
  { id: "ce1", label: "CE1", sub: "+ et − jusqu'à 100" },
  { id: "ce2", label: "CE2", sub: "+, − et tables 2, 3" }
];

// Niveaux solo : le type de calculs, le nombre de calculs, le temps pour chacun, et les bonnes réponses
// pour 1, 2 et 3 étoiles.
const LEVELS = [
  { gen: "petit", count: 10, time: 12, stars: [5, 7, 9], goal: "Des additions jusqu'à 10. Compte les points si tu veux !" },
  { gen: "plus20", count: 10, time: 12, stars: [5, 7, 9], goal: "Des additions jusqu'à 20. Réponds avant la fin de la barre !" },
  { gen: "moins20", count: 10, time: 12, stars: [5, 7, 9], goal: "Des soustractions jusqu'à 20." },
  { gen: "cp", count: 10, time: 11, stars: [5, 7, 9], goal: "Additions et soustractions mélangées : regarde bien le signe !" },
  { gen: "plus100", count: 10, time: 12, stars: [5, 7, 9], goal: "Des additions jusqu'à 100. Pense aux dizaines !" },
  { gen: "moins100", count: 10, time: 12, stars: [5, 7, 9], goal: "Des soustractions jusqu'à 100." },
  { gen: "table2", count: 10, time: 10, stars: [5, 7, 9], goal: "La table de 2. Une série de 3 bonnes réponses donne un bonus !" },
  { gen: "table3", count: 10, time: 10, stars: [5, 7, 9], goal: "La table de 3." },
  { gen: "tables", count: 12, time: 9, stars: [6, 9, 11], goal: "Les tables de 2 et de 3 mélangées." },
  { gen: "ce2", count: 15, time: 9, stars: [8, 11, 14], goal: "Le défi des champions : additions, soustractions et tables de 2 et 3 !" }
];
const ROBOT = {
  1: { time: [4.5, 7.5], right: 0.8, grade: "cp" },
  2: { time: [3, 5], right: 0.9, grade: "ce1" },
  3: { time: [1.8, 3.2], right: 0.97, grade: "ce2" }
};

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
const fr = n => String(n);

/* ---------- Les calculs ---------- */

const plus = (a, b) => ({ text: `${a} + ${b}`, answer: a + b });
const minus = (a, b) => ({ text: `${a} − ${b}`, answer: a - b });
// Table de n : parfois « n × 4 », parfois « 4 × n ».
const table = n => { const b = rand(1, 10); return Math.random() < 0.5 ? { text: `${n} × ${b}`, answer: n * b, table: [n, b] } : { text: `${b} × ${n}`, answer: n * b, table: [b, n] }; };

const GEN = {
  petit() { const a = rand(0, 7), b = rand(1, 10 - a); return { ...plus(a, b), dots: [a, b] }; },
  plus20() { const a = rand(2, 15), b = rand(1, 20 - a); return plus(a, b); },
  moins20() { const a = rand(5, 20), b = rand(1, a); return minus(a, b); },
  cp() { return Math.random() < 0.5 ? GEN.plus20() : GEN.moins20(); },
  plus100() {
    const kind = rand(0, 3);
    if (kind === 0) return plus(rand(1, 8) * 10, rand(1, 9));          // 40 + 7
    if (kind === 1) return plus(rand(1, 5) * 10, rand(1, 4) * 10);     // 30 + 20
    const a = rand(11, 79);
    return plus(a, rand(2, Math.min(kind === 2 ? 9 : 20, 99 - a)));    // 46 + 8, 35 + 17
  },
  moins100() {
    const kind = rand(0, 2);
    if (kind === 0) { const a = rand(3, 9) * 10; return minus(a, rand(1, a / 10 - 1) * 10); }   // 70 − 30
    const a = rand(20, 99);
    return minus(a, rand(2, kind === 1 ? Math.min(9, a % 10 || 9) : Math.min(19, a - 1)));     // 47 − 5, 52 − 14
  },
  ce1() { return Math.random() < 0.5 ? GEN.plus100() : GEN.moins100(); },
  table2() { return table(2); },
  table3() { return table(3); },
  tables() { return table(pickOne([2, 3])); },
  ce2() { const k = rand(0, 2); return k === 0 ? GEN.plus100() : k === 1 ? GEN.moins100() : GEN.tables(); }
};

// Trois mauvaises réponses qui ressemblent à la bonne.
function choicesFor(q) {
  const right = q.answer;
  const near = new Set();
  const step = 1;
  const ideas = [right + step, right - step, right + 2 * step, right - 2 * step, right + 10, right - 10];
  if (q.table) { const [a, b] = q.table; ideas.push(a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b); }
  if (right >= 10 && Number.isInteger(right) && right % 10) { const s = String(right); ideas.push(Number(s.split("").reverse().join(""))); }
  for (const v of shuffle(ideas)) {
    if (near.size >= 3) break;
    if (v >= 0 && v !== right && !near.has(v)) near.add(v);
  }
  let extra = right + 3 * step;
  while (near.size < 3) { if (extra !== right && extra >= 0) near.add(extra); extra += step; }
  return shuffle([right, ...near]);
}

function makeQuestion(gen) {
  const q = (GEN[gen] || GEN.cp)();
  return { ...q, choices: choicesFor(q) };
}

const dotsHTML = ([a, b]) => `<div class="ce-dots"><span>${"<i></i>".repeat(a)}</span><b>+</b><span>${"<i></i>".repeat(b)}</span></div>`;

function remembered() { try { return JSON.parse(localStorage.getItem(MEMORY)) || {}; } catch { return {}; } }
function remember(profileId, grade) {
  try { const all = remembered(); all[profileId] = grade; localStorage.setItem(MEMORY, JSON.stringify(all)); } catch { /* stockage bloqué */ }
}

/* ---------- Le jeu ---------- */

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const players = ctx.seats;
  const N = players.length;
  const memory = remembered();
  // Niveau de calcul de chaque joueur (le robot calcule au niveau de sa force).
  const grade = players.map(p => p.kind === "robot" ? ROBOT[p.level]?.grade || "ce1" : (GRADES.some(g => g.id === memory[p.profile?.id]) ? memory[p.profile?.id] : null));
  const scores = players.map(() => 0);
  const series = players.map(() => 0);
  let best = 0, right = 0, asked = 0;
  const total = level ? level.count : 15;

  const node = h(`<div class="ce n${N} ${solo ? "solo" : ""}">
    ${players.map((p, i) => `
      <section class="ce-zone pos-${i} ${p.kind}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="ce-inner">
          <div class="ce-head"><span class="ce-avatar">${p.art}</span><span class="ce-name">${p.label}</span>
            <span class="ce-series" hidden></span><span class="ce-score"></span></div>
          <div class="ce-bar"><i></i></div>
          <div class="ce-body"></div>
        </div>
      </section>`).join("")}
  </div>`);
  root.append(node);
  const zones = [...node.querySelectorAll(".ce-zone")];
  const body = i => zones[i].querySelector(".ce-body");
  const bar = i => zones[i].querySelector(".ce-bar i");

  let clock = 0, events = [];
  const after = (delay, fn) => events.push({ time: clock + delay, fn });
  let phase = "choose", questions = [], openAt = [], locked = [], roundStart = 0, roundTime = ROUND_TIME, startTimer = null, robotAt = [];

  function renderHead() {
    zones.forEach((z, i) => {
      z.querySelector(".ce-score").textContent = solo ? `${right} / ${total}` : `${scores[i]} / ${GOAL}`;
      const s = z.querySelector(".ce-series");
      s.hidden = series[i] < 3;
      s.textContent = `🔥 ${series[i]}`;
    });
  }

  /* ---------- Choix du niveau ---------- */

  function showChoosers() {
    phase = "choose";
    players.forEach((p, i) => {
      if (p.kind !== "human") { body(i).innerHTML = `<p class="ce-wait">Le robot est prêt !</p>`; return; }
      body(i).innerHTML = `<p class="ce-ask">Ton niveau de calcul ?</p>
        <div class="ce-grades">${GRADES.map(g => `<button class="ce-grade ${grade[i] === g.id ? "on" : ""}" data-grade="${g.id}"><b>${g.label}</b><small>${g.sub}</small></button>`).join("")}</div>
        <p class="ce-ready"></p>`;
    });
    checkReady();
  }

  function checkReady() {
    clearInterval(startTimer);
    const waiting = players.some((p, i) => p.kind === "human" && !grade[i]);
    zones.forEach((z, i) => { const r = z.querySelector(".ce-ready"); if (r) r.textContent = grade[i] ? (waiting ? "Prêt ! On attend les autres…" : "") : ""; });
    if (waiting) return;
    let left = 3;
    const tick = () => {
      zones.forEach(z => { const r = z.querySelector(".ce-ready"); if (r) r.textContent = left > 0 ? `On commence dans ${left}…` : ""; });
      if (left <= 0) { clearInterval(startTimer); startMatch(); }
      left--;
    };
    tick();
    startTimer = setInterval(tick, 1000);
  }

  function startMatch() {
    // Les niveaux solo ont leurs propres calculs : on ne retient que le niveau choisi par l'enfant.
    if (!level) players.forEach((p, i) => { if (p.kind === "human" && p.profile) remember(p.profile.id, grade[i]); });
    renderHead();
    say(solo ? "C'est parti !" : "Le plus rapide marque !");
    after(0.6, nextRound);
  }

  /* ---------- Les manches ---------- */

  function nextRound() {
    phase = "question";
    asked++;
    roundStart = clock;
    roundTime = solo ? (level ? level.time : Math.max(5, 10 - (asked - 1) * 0.35)) : ROUND_TIME;
    const maxBoost = Math.max(...players.map(p => p.boost || 0));
    questions = players.map((p, i) => makeQuestion(solo && level ? level.gen : grade[i]));
    locked = players.map(() => false);
    // Coup de pouce : le calcul apparaît un peu plus tôt pour le plus petit.
    openAt = players.map(p => clock + (maxBoost - (p.boost || 0)) * 0.8);
    robotAt = players.map(p => {
      if (p.kind !== "robot") return Infinity;
      const brain = ROBOT[p.level] || ROBOT[2];
      return clock + between(...brain.time);
    });
    players.forEach((p, i) => {
      const q = questions[i];
      body(i).innerHTML = `<div class="ce-question"><span class="ce-q">${q.text} = ?</span>${q.dots ? dotsHTML(q.dots) : ""}</div>
        <div class="ce-choices">${q.choices.map(v => `<button class="ce-choice" data-v="${v}">${fr(v)}</button>`).join("")}</div>`;
      zones[i].classList.toggle("hidden-q", openAt[i] > clock);
      zones[i].classList.remove("won", "wrong-zone");
    });
    play("pop");
  }

  function answer(i, value, button) {
    if (phase !== "question" || locked[i] || clock < openAt[i]) return;
    const q = questions[i];
    if (value === q.answer) {
      button?.classList.add("good");
      play("point");
      series[i]++;
      if (solo) {
        right++;
        best = Math.max(best, series[i]);
        if (series[i] > 0 && series[i] % 3 === 0) { play("star"); flash(i, "Série de " + series[i] + " !"); }
        else flash(i, "Bravo !");
        endRound(i);
      } else {
        scores[i]++;
        zones[i].classList.add("won");
        flash(i, series[i] >= 3 ? `Série de ${series[i]} !` : "Le plus rapide !");
        players.forEach((_, k) => { if (k !== i) series[k] = 0; });
        endRound(i);
      }
    } else {
      locked[i] = true;
      series[i] = 0;
      button?.classList.add("bad");
      zones[i].classList.add("wrong-zone");
      play("wrong");
      if (solo) { flash(i, `C'était ${fr(q.answer)}`); endRound(-1); }
      else if (players.every((p, k) => locked[k] || p.kind === "robot")) {
        // Tous les enfants se sont trompés : la manche continue pour les robots seulement s'il y en a.
        if (!players.some(p => p.kind === "robot")) endRound(-1);
      }
    }
    renderHead();
  }

  function flash(i, message) {
    const m = h(`<div class="ce-flash">${message}</div>`);
    zones[i].querySelector(".ce-inner").append(m);
    setTimeout(() => m.remove(), 1300);
  }

  function endRound(winner) {
    phase = "reveal";
    // On montre la bonne réponse dans chaque zone.
    players.forEach((_, i) => {
      zones[i].classList.remove("hidden-q");
      body(i).querySelectorAll(".ce-choice").forEach(b => { if (Number(b.dataset.v) === questions[i].answer) b.classList.add("good"); b.disabled = true; });
    });
    if (winner < 0 && !solo) flash(0, "Personne !");
    renderHead();
    after(solo ? 1.3 : 1.6, () => {
      if (solo ? asked >= total : scores.some(s => s >= GOAL)) return finish();
      nextRound();
    });
  }

  function finish() {
    phase = "done";
    if (solo) {
      const thresholds = level ? level.stars : [8, 11, 14];
      const stars = thresholds.filter(need => right >= need).length;
      ctx.finish({
        solo: {
          stars, value: right, lowerIsBetter: false,
          format: v => `${v} bonne${v > 1 ? "s" : ""} réponse${v > 1 ? "s" : ""}`,
          label: `${right} bonne${right > 1 ? "s" : ""} réponse${right > 1 ? "s" : ""} sur ${total}${best >= 3 ? ` · série de ${best}` : ""}`,
          speech: right >= total - 1 ? "Quel champion du calcul !" : `${right} bonnes réponses !`,
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : ${thresholds[stars]} bonnes réponses`
        }
      });
      return;
    }
    ctx.finish({ ranking: scores.map((score, seat) => ({ seat, score, label: `${score} point${score > 1 ? "s" : ""}` })) });
  }

  /* ---------- Commandes ---------- */

  const onDown = event => {
    const button = event.target.closest(".ce-grade, .ce-choice");
    if (!button) return;
    const i = zones.findIndex(z => z.contains(button));
    if (i < 0 || players[i].kind !== "human") return;
    event.preventDefault();
    if (button.classList.contains("ce-grade")) {
      if (phase !== "choose") return;
      grade[i] = button.dataset.grade;
      body(i).querySelectorAll(".ce-grade").forEach(b => b.classList.toggle("on", b === button));
      play("tap");
      checkReady();
      return;
    }
    answer(i, Number(button.dataset.v), button);
  };
  node.addEventListener("pointerdown", onDown);

  /* ---------- Boucle ---------- */

  function update(dt) {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    if (phase !== "question") return;
    const left = Math.max(0, 1 - (clock - roundStart) / roundTime);
    players.forEach((p, i) => {
      if (clock >= openAt[i]) zones[i].classList.remove("hidden-q");
      bar(i).style.transform = `scaleX(${left})`;
      if (p.kind === "robot" && !locked[i] && clock >= robotAt[i] && phase === "question") {
        const brain = ROBOT[p.level] || ROBOT[2];
        const q = questions[i];
        const value = Math.random() < brain.right ? q.answer : pickOne(q.choices.filter(v => v !== q.answer));
        const button = [...body(i).querySelectorAll(".ce-choice")].find(b => Number(b.dataset.v) === value);
        answer(i, value, button);
      }
    });
    if (phase === "question" && left <= 0) {
      if (solo) { series[0] = 0; flash(0, `C'était ${fr(questions[0].answer)}`); play("wrong"); }
      endRound(-1);
    }
  }

  const loop = createLoop(update);

  return {
    start() {
      renderHead();
      if (solo && level) { grade[0] = level.gen; startMatch(); }
      else showChoosers();
      loop.start();
    },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); clearInterval(startTimer); }
  };
}

/* ---------- Démonstration des règles ---------- */

function demo() {
  const node = h(`<div class="ce-demo">
    <div class="ce-demo-q">3 + 4 = ?</div>
    <div class="ce-demo-grid"><span>6</span><span class="yes">7</span><span>8</span><span>5</span></div>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "calcul-eclair",
  title: "Calcul-éclair",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFF1C9", ink: "#8A5A00" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="18" y="16" width="124" height="40" rx="14" fill="#fff" stroke="#2B2350" stroke-width="3"/>
    <text x="80" y="45" text-anchor="middle" font-size="26" font-weight="700" fill="#2B2350" font-family="Fredoka, sans-serif">3 × 4 = ?</text>
    <rect x="18" y="64" width="58" height="22" rx="9" fill="#DCE9FC" stroke="#2F80ED" stroke-width="3"/>
    <rect x="84" y="64" width="58" height="22" rx="9" fill="#27AE60" stroke="#18804A" stroke-width="3"/>
    <rect x="18" y="92" width="58" height="22" rx="9" fill="#DCE9FC" stroke="#2F80ED" stroke-width="3"/>
    <rect x="84" y="92" width="58" height="22" rx="9" fill="#DCE9FC" stroke="#2F80ED" stroke-width="3"/>
    <text x="113" y="81" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" font-family="Fredoka, sans-serif">12</text>
    <path d="M140 8 l-10 16 h8 l-6 14 l14 -18 h-8 l6 -12z" fill="#FFC83D" stroke="#2B2350" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Un calcul s'affiche : touche vite la bonne réponse avant la fin de la barre ! Trois bonnes réponses de suite font une série."
      : `Chacun choisit son niveau de calcul. Un calcul s'affiche dans chaque zone : le premier qui touche la bonne réponse marque un point. Attention, une erreur et tu attends le calcul suivant ! ${GOAL} points pour gagner.`,
    demo
  },
  levels: LEVELS,
  mount
};
