// Top départ : attendre le bon signal, puis taper le premier.
import { avatarArt, shapeSVG, icon } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";

const GOAL = 5;            // points pour gagner à plusieurs
const SOLO_ROUNDS = 8;     // manches du défi solo
const BOOST_MS = [0, 100, 200];
const ROBOT = {
  1: { min: 560, spread: 280, fooled: 0.3 },
  2: { min: 400, spread: 170, fooled: 0.12 },
  3: { min: 280, spread: 110, fooled: 0.04 }
};
const INK = "#2B2350";

/* ---------- Dessins des signaux ---------- */

function lightSVG(lit) {
  const lamp = (color, y, on) => `<circle cx="50" cy="${y}" r="15" fill="${on ? color : "#4A4270"}"/>${on ? `<circle cx="50" cy="${y}" r="21" fill="${color}" opacity=".28"/><circle cx="45" cy="${y - 5}" r="4" fill="#fff" opacity=".7"/>` : ""}`;
  return `<svg viewBox="0 0 100 130" aria-hidden="true"><rect x="47" y="112" width="6" height="16" fill="${INK}"/>
    <rect x="24" y="4" width="52" height="112" rx="20" fill="${INK}"/>
    ${lamp("#FF5A5A", 30, lit === "rouge")}${lamp("#FFB23E", 60, lit === "orange")}${lamp("#3DDC84", 90, lit === "vert")}</svg>`;
}

const SIGNS = {
  rouge: { art: () => lightSVG("rouge") },
  orange: { art: () => lightSVG("orange") },
  vert: { art: () => lightSVG("vert"), say: "le feu vert" },
  chat: { art: () => avatarArt("chat"), say: "le chat" },
  lapin: { art: () => avatarArt("lapin"), say: "le lapin" },
  renard: { art: () => avatarArt("renard") },
  ours: { art: () => avatarArt("ours") },
  grenouille: { art: () => avatarArt("grenouille") },
  hibou: { art: () => avatarArt("hibou") },
  panda: { art: () => avatarArt("panda") }
};
const ANIMALS = ["chat", "lapin", "renard", "ours", "grenouille", "hibou", "panda"];

const pickOne = list => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);

// Ce que réserve une manche : la cible, les pièges, le moment du départ.
function planRound(round, solo) {
  const stage = solo ? round / SOLO_ROUNDS : Math.min(1, round / 9);
  let target = "vert";
  if (stage >= 0.6 && Math.random() < 0.6) target = pickOne(["chat", "lapin"]);
  const trapCount = stage < 0.25 ? 0 : stage < 0.5 ? (Math.random() < 0.6 ? 1 : 0) : 1 + Math.floor(Math.random() * (stage > 0.8 ? 3 : 2));
  const goAt = between(1500, 3200) + trapCount * 700;
  const traps = [];
  const pool = target === "vert"
    ? (stage >= 0.4 ? ["orange", "orange", ...ANIMALS] : ["orange"])
    : ["vert", "vert", ...ANIMALS.filter(a => a !== target)];
  for (let i = 0; i < trapCount; i++) {
    const at = 700 + (i + 1) * (goAt - 1100) / (trapCount + 1) + between(-150, 150);
    traps.push({ at, sign: pickOne(pool) });
  }
  return { target, traps, goAt };
}

function speedWord(ms) {
  if (ms < 330) return "un guépard";
  if (ms < 430) return "un lapin";
  if (ms < 560) return "un chat";
  if (ms < 720) return "un chien";
  return "une tortue";
}

/* ---------- Le jeu ---------- */

function mount(root, ctx) {
  const { seats, count } = ctx;
  const solo = count === 1;
  const scores = seats.map(() => 0);
  const times = [];
  let errors = 0;

  const node = h(`<div class="td n${count}">
    ${seats.map((seat, i) => `
      <section class="td-zone pos-${i} ${seat.kind}" data-seat="${i}" style="--seat:${seat.color};--seat-deep:${seat.deep};--seat-soft:${seat.soft}">
        <div class="td-inner">
          <div class="td-head"><span class="td-avatar">${seat.art}</span><span class="td-name">${seat.label}</span>
            ${solo ? `<span class="td-round"></span>` : `<span class="td-pips">${"<i></i>".repeat(GOAL)}</span>`}</div>
          <div class="td-buzzer">${shapeSVG(seat.shape, "#fff")}</div>
          <div class="td-goal" aria-hidden="true"></div>
          <div class="td-msg" aria-live="polite"></div>
        </div>
      </section>`).join("")}
    <div class="td-signal"><div class="td-sign"></div></div>
  </div>`);
  root.append(node);
  const zones = [...node.querySelectorAll(".td-zone")];
  const signal = node.querySelector(".td-signal");
  const sign = node.querySelector(".td-sign");

  // Horloge du jeu : elle s'arrête pendant la pause.
  // Pas de dessin image par image ici : un minuteur de 15 ms suffit.
  let clock = 0, last = 0, running = false, timer = 0;
  let events = [];
  const at = (time, fn) => events.push({ time, fn });
  const after = (delay, fn) => at(clock + delay, fn);
  // Heure précise d'un appui, entre deux tics.
  const exactNow = () => running ? clock + Math.min(64, performance.now() - last) : clock;
  function tick() {
    const now = performance.now();
    if (running) {
      clock += Math.min(64, now - last);
      const due = events.filter(e => e.time <= clock);
      events = events.filter(e => e.time > clock);
      due.sort((a, b) => a.time - b.time).forEach(e => e.fn());
    }
    last = now;
  }

  let round = -1, phase = "idle", plan = null, goTime = 0, out = new Set(), taps = new Map(), lastTarget = null;

  function show(name, mode = "") {
    sign.innerHTML = SIGNS[name].art();
    signal.className = "td-signal " + mode;
  }
  function message(i, text, mood = "") {
    const box = zones[i].querySelector(".td-msg");
    box.textContent = text;
    box.className = "td-msg " + mood;
  }
  function clearZones() {
    zones.forEach((zone, i) => { zone.classList.remove("out", "won", "lost", "pressed"); message(i, ""); });
  }
  function renderScores() {
    zones.forEach((zone, i) => {
      if (solo) zone.querySelector(".td-round").textContent = `${Math.min(round + 1, SOLO_ROUNDS)} / ${SOLO_ROUNDS}`;
      else zone.querySelectorAll(".td-pips i").forEach((pip, k) => pip.classList.toggle("on", k < scores[i]));
    });
  }

  function nextRound() {
    round++;
    events = []; // oublie les signaux encore prévus pour la manche précédente
    if (solo && round >= SOLO_ROUNDS) return endSolo();
    plan = planRound(round, solo);
    out = new Set();
    taps = new Map();
    clearZones();
    renderScores();
    const goal = SIGNS[plan.target].art();
    zones.forEach(zone => { zone.querySelector(".td-goal").innerHTML = goal; });
    // On annonce la cible quand elle change (et au début).
    if (plan.target !== lastTarget) {
      lastTarget = plan.target;
      phase = "preview";
      show(plan.target, "preview");
      const sentence = round === 0
        ? (plan.target === "vert" ? "Attends le feu vert… puis tape !" : `Tape seulement sur ${SIGNS[plan.target].say} !`)
        : `Attention ! Maintenant, tape seulement sur ${SIGNS[plan.target].say} !`;
      say(sentence);
      play("pop");
      after(round === 0 ? 2600 : 2900, startWaiting);
    } else {
      startWaiting();
    }
  }

  function startWaiting() {
    phase = "wait";
    show("rouge", "wait");
    const start = clock;
    plan.traps.forEach(trap => {
      at(start + trap.at, () => { if (phase === "wait") show(trap.sign, "trap"); });
      at(start + trap.at + 650, () => { if (phase === "wait") show("rouge", "wait"); });
      seats.forEach((seat, i) => {
        if (seat.kind === "robot" && Math.random() < ROBOT[seat.level].fooled) at(start + trap.at + between(260, 480), () => falseStart(i));
      });
    });
    at(start + plan.goAt, go);
  }

  function go() {
    if (phase !== "wait") return;
    phase = "go";
    goTime = clock;
    show(plan.target, "go");
    play("go");
    seats.forEach((seat, i) => {
      if (seat.kind === "robot") after(ROBOT[seat.level].min + Math.random() * ROBOT[seat.level].spread, () => press(i));
    });
    const thisRound = round;
    after(2600, () => { if (round === thisRound && phase === "go" && !taps.size) noTap(); });
  }

  function press(i) {
    if (phase === "wait") return falseStart(i);
    if (phase !== "go" || out.has(i) || taps.has(i)) return;
    taps.set(i, exactNow());
    zones[i].classList.add("pressed");
    play("tap");
    // Petite fenêtre d'attente : un coup de pouce peut encore faire gagner un autre joueur.
    if (taps.size === 1) after(solo ? 0 : 210, resolve);
  }

  function falseStart(i) {
    if (phase !== "wait" || out.has(i)) return;
    out.add(i);
    zones[i].classList.add("out");
    message(i, "Trop tôt !", "bad");
    play("wrong");
    if (solo) {
      errors++;
      phase = "resolve";
      show("rouge", "wait");
      after(1300, nextRound);
      return;
    }
    if (out.size === seats.length) {
      phase = "resolve";
      after(1300, nextRound);
    }
  }

  function noTap() {
    phase = "resolve";
    if (solo) { errors++; message(0, "Trop lent !", "bad"); play("wrong"); }
    after(1200, nextRound);
  }

  function resolve() {
    if (phase !== "go") return;
    phase = "resolve";
    let winner = null, best = Infinity;
    taps.forEach((time, i) => {
      const effective = time - BOOST_MS[seats[i].boost || 0];
      if (effective < best) { best = effective; winner = i; }
    });
    if (solo) {
      const reaction = taps.get(0) - goTime;
      times.push(reaction);
      zones[0].classList.add("won");
      message(0, `${Math.round(reaction)} ms`, "good");
      play(reaction < 430 ? "point" : "star");
      after(1300, nextRound);
      return;
    }
    scores[winner]++;
    renderScores();
    zones.forEach((zone, i) => {
      if (i === winner) { zone.classList.add("won"); message(i, "Gagné !", "good"); }
      else if (!out.has(i)) { zone.classList.add("lost"); message(i, "Raté…"); }
    });
    play("point");
    if (scores[winner] >= GOAL) {
      phase = "done";
      after(900, () => ctx.finish({ ranking: scores.map((score, seat) => ({ seat, score })) }));
    } else {
      after(1500, nextRound);
    }
  }

  function endSolo() {
    phase = "done";
    const average = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    let starsWon = 0;
    if (average !== null) starsWon = 1;
    if (average !== null && average < 560 && errors <= 2) starsWon = 2;
    if (average !== null && average < 430 && errors <= 1) starsWon = 3;
    const fault = errors ? ` · ${errors} raté${errors > 1 ? "s" : ""}` : "";
    ctx.finish({
      solo: {
        stars: starsWon,
        value: average,
        lowerIsBetter: true,
        format: v => `${Math.round(v)} ms`,
        label: average === null ? "Aucun bon départ cette fois." : `Rapide comme ${speedWord(average)} : ${Math.round(average)} ms${fault}`,
        speech: average === null ? "" : `Tu es rapide comme ${speedWord(average)} !`,
        next: starsWon === 3 ? "" : starsWon === 2 ? "3 étoiles : moins de 430 ms, 1 raté au plus" : "2 étoiles : moins de 560 ms, 2 ratés au plus"
      }
    });
  }

  // Chaque joueur touche n'importe où dans sa zone.
  zones.forEach((zone, i) => {
    if (seats[i].kind !== "human") return;
    zone.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (running) press(i);
    });
  });
  // Au clavier (pour tester sur ordinateur) : Espace = Bleu, Entrée = Rouge.
  const onKey = event => {
    if (event.repeat || !running) return;
    const index = { " ": 0, Enter: 1 }[event.key];
    if (index === undefined || index >= seats.length || seats[index].kind !== "human") return;
    event.preventDefault();
    press(index);
  };
  document.addEventListener("keydown", onKey);

  return {
    start() {
      running = true;
      last = performance.now();
      timer = setInterval(tick, 15);
      renderScores();
      show("rouge", "wait");
      after(500, nextRound);
    },
    pause() { running = false; },
    resume() { last = performance.now(); running = true; },
    destroy() {
      running = false;
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
    }
  };
}

/* ---------- Démonstration des règles ---------- */

function demo() {
  const node = h(`<div class="td-demo">
    <div class="td-demo-light"></div>
    <div class="td-demo-hand">${icon("eclair")}</div>
    <div class="td-demo-mark"></div>
  </div>`);
  const steps = [
    { light: "rouge", mark: "" },
    { light: "orange", mark: "no" },
    { light: "rouge", mark: "" },
    { light: "vert", mark: "yes" }
  ];
  let k = 0;
  const lightBox = node.querySelector(".td-demo-light");
  const mark = node.querySelector(".td-demo-mark");
  const step = () => {
    const s = steps[k++ % steps.length];
    lightBox.innerHTML = lightSVG(s.light);
    node.dataset.step = s.light;
    mark.className = "td-demo-mark " + s.mark;
    mark.innerHTML = s.mark === "yes" ? icon("lecture") : s.mark === "no" ? icon("croix") : "";
  };
  step();
  const timer = setInterval(step, 1100);
  return { node, stop: () => clearInterval(timer) };
}

/* ---------- Fiche du jeu ---------- */

export default {
  id: "top-depart",
  title: "Top départ",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFE3B8", ink: "#7A3E00" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <ellipse cx="80" cy="108" rx="70" ry="9" fill="#00000014"/>
    <circle cx="30" cy="92" r="17" fill="#2F80ED"/><circle cx="30" cy="88" r="17" fill="#5A9BF2"/>
    <circle cx="130" cy="92" r="17" fill="#EB5757"/><circle cx="130" cy="88" r="17" fill="#F17A7A"/>
    <g transform="translate(55 4) scale(.5)">${lightSVG("vert").replace(/<\/?svg[^>]*>/g, "")}</g>
    <path d="M18 44 l8 6 M14 58 h10 M142 44 l-8 6 M146 58 h-10" stroke="#7A3E00" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "Attends le feu vert, puis tape le plus vite possible. Si tu tapes trop tôt, c'est raté !"
      : `Attends le feu vert, puis tape dans ta zone avant les autres. Trop tôt ? Tu perds la manche ! Le premier à ${GOAL} points gagne.`,
    demo
  },
  mount
};
