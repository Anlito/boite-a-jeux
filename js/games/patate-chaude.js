// Patate chaude : une bombe passe de joueur en joueur. Pour la renvoyer, il faut réussir un mini-défi
// dans sa zone (éclater des ballons, les taper dans l'ordre, refaire une suite…). La mèche brûle,
// et personne ne sait exactement quand elle va exploser. Celui qui la tient perd un cœur.
import { SEATS, robotArt, hasImage, imagePath } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";

const LIVES = 2;                 // cœurs de chacun à plusieurs
const SOLO_LIVES = 3;            // cœurs de l'enfant en solo
const FLIGHT = 0.6;              // durée du vol de la bombe (secondes)
const ALL = ["ballons", "ordre", "couleur", "mouvants", "frappe", "simon"];

// Niveaux solo : robots et leurs cœurs, mini-défis possibles, taille des défis, durée de la mèche.
// Les étoiles : les cœurs gardés par l'enfant quand il gagne.
const LEVELS = [
  { robots: [1], robotLives: 1, kinds: ["ballons"], size: 3, fuse: [14, 20], goal: "Éclate les 3 ballons pour renvoyer la bombe au robot !" },
  { robots: [1], robotLives: 2, kinds: ["ballons", "frappe"], size: 3, fuse: [14, 20], goal: "Nouveau défi : tape vite sur le tambour !" },
  { robots: [1, 1], robotLives: 1, kinds: ["ballons", "ordre"], size: 3, fuse: [13, 19], goal: "Deux robots ! Et des ballons à éclater dans l'ordre : 1, 2, 3." },
  { robots: [2], robotLives: 2, kinds: ["ballons", "ordre", "couleur"], size: 4, fuse: [13, 18], goal: "Nouveau défi : éclate seulement les ballons de ta couleur !" },
  { robots: [1, 2], robotLives: 1, kinds: ["couleur", "mouvants", "frappe"], size: 4, fuse: [12, 17], goal: "Les ballons s'envolent ! Attrape-les vite." },
  { robots: [2, 2], robotLives: 1, kinds: ["ordre", "mouvants", "couleur"], size: 4, fuse: [11, 16], goal: "Deux robots malins et une mèche plus courte !" },
  { robots: [3], robotLives: 2, kinds: ["simon", "ballons", "ordre"], size: 4, fuse: [11, 16], goal: "Nouveau défi : regarde les lumières, puis refais la même suite !" },
  { robots: [2, 3], robotLives: 1, kinds: ["simon", "mouvants", "couleur", "frappe"], size: 5, fuse: [10, 15], goal: "Le robot fort est là. Sois rapide !" },
  { robots: [2, 2, 3], robotLives: 1, kinds: ALL, size: 5, fuse: [9, 14], goal: "Trois robots et tous les défis !" },
  { robots: [3, 3, 3], robotLives: 1, kinds: ALL, size: 5, fuse: [8, 13], goal: "Le défi des champions : trois robots forts !" }
];
const FREE = { robots: [1, 2, 3], robotLives: 1, kinds: ALL, size: 4, fuse: [11, 16] };
const MULTI = { kinds: ALL, size: 4, fuse: [12, 18] };
// Temps entre deux appuis du robot, temps de réaction, chance de se tromper.
const ROBOT = {
  1: { tap: 1.05, react: 0.9, mistake: 0.18 },
  2: { tap: 0.7, react: 0.6, mistake: 0.08 },
  3: { tap: 0.46, react: 0.35, mistake: 0.03 }
};
const COLORS = ["#FF6B6B", "#4D96FF", "#5CC96B", "#FFD93D", "#B983FF", "#FF9F43"];
// Couleur des ballons de chaque place, et son nom pour la consigne.
const SEAT_BALL = { Bleu: ["#4D96FF", "bleus"], Rouge: ["#FF6B6B", "rouges"], Vert: ["#5CC96B", "verts"], Jaune: ["#FFD93D", "jaunes"] };
const SIMON = ["#FF6B6B", "#4D96FF", "#5CC96B", "#FFD93D"];
const INK = "#2B2350";
const HINT = {
  ballons: "Éclate les ballons !",
  ordre: "Dans l'ordre : 1, 2, 3…",
  mouvants: "Attrape les ballons !",
  frappe: "Tape vite sur le tambour !",
  simon: "Regarde bien, puis refais !"
};

const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

// Images du lot 11 (si absentes : les dessins ci-dessous).
const pic = name => hasImage(`patate-chaude/${name}`) ? imagePath(`patate-chaude/${name}`) : null;
const BALLOON_PICS = { "#FF6B6B": "rouge", "#4D96FF": "bleu", "#5CC96B": "vert", "#FFD93D": "jaune", "#B983FF": "violet", "#FF9F43": "orange" };
const POP_PIC = pic("ballon-eclate.png");
// Ballon du lot à la couleur demandée (avec le numéro par-dessus pour le défi « dans l'ordre »).
const balloonHTML = (label, color) => {
  const src = color && pic(`ballon-${BALLOON_PICS[color]}.png`);
  if (!src) return balloonSVG(label);
  return `<img src="${src}" alt="" draggable="false">${label ? `<span class="pc-ball-num">${label}</span>` : ""}`;
};
const balloonSVG = (label = "") => `<svg viewBox="0 0 60 84" aria-hidden="true">
  <path d="M30 60 q-5 9 2 22" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M25 61 h10 l-5 -6z" style="fill:var(--c)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="30" cy="30" rx="25" ry="28" style="fill:var(--c)" stroke="${INK}" stroke-width="3.5"/>
  <ellipse cx="20" cy="18" rx="5" ry="8" fill="#fff" opacity=".55" transform="rotate(20 20 18)"/>
  ${label ? `<text x="30" y="40" text-anchor="middle" font-size="28" font-weight="700" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke">${label}</text>` : ""}
</svg>`;

const BOMB = pic("bombe.png"), BOMB_PANIC = pic("bombe-panique.png");
const bombSVG = () => BOMB ? `<svg viewBox="0 0 512 512" aria-hidden="true">
  <path d="M232 122 C226 58 320 34 430 92" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round" opacity=".25"/>
  <path class="pc-fuse-out" d="M232 122 C226 58 320 34 430 92" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round" pathLength="1"/>
  <path class="pc-fuse" d="M232 122 C226 58 320 34 430 92" stroke="#F4D7A4" stroke-width="20" fill="none" stroke-linecap="round" pathLength="1"/>
  <image class="pc-body calm" href="${BOMB}" width="512" height="512"/>
  ${BOMB_PANIC ? `<image class="pc-body panic" href="${BOMB_PANIC}" width="512" height="512" x="-22" y="-6"/>` : ""}
  <g class="pc-spark"><circle r="42" fill="#FFC83D" opacity=".55"/><circle r="22" fill="#FFF3B0"/></g>
</svg>` : `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path class="pc-fuse-bg" d="M62 26 q12 -16 28 -10" stroke="#00000022" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path class="pc-fuse" d="M62 26 q12 -16 28 -10" stroke="#C9A36B" stroke-width="5" fill="none" stroke-linecap="round" pathLength="1"/>
  <rect x="50" y="20" width="20" height="15" rx="4" fill="#5A4F86" stroke="${INK}" stroke-width="3" transform="rotate(35 60 27)"/>
  <circle cx="44" cy="60" r="33" fill="#3A3168" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="30" cy="46" rx="8" ry="11" fill="#fff" opacity=".22" transform="rotate(30 30 46)"/>
  <circle cx="34" cy="62" r="7.5" fill="#fff"/><circle cx="54" cy="62" r="7.5" fill="#fff"/>
  <circle class="pc-eye" cx="35" cy="63" r="3.6" fill="${INK}"/><circle class="pc-eye" cx="55" cy="63" r="3.6" fill="${INK}"/>
  <path d="M38 77 q6 -4 12 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g class="pc-spark"><circle r="9" fill="#FFC83D" opacity=".55"/><circle r="5" fill="#FFF3B0"/></g>
</svg>`;
const BOOM = pic("boum.png");

const boomSVG = () => BOOM ? `<img src="${BOOM}" alt="" draggable="false">` : `<svg viewBox="0 0 120 120" aria-hidden="true">
  <path d="M60 4 L70 34 L100 16 L88 46 L118 52 L90 66 L110 94 L78 84 L72 116 L58 88 L36 112 L38 80 L6 88 L28 62 L2 44 L34 42 L22 12 L48 32 Z" fill="#FFC83D" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M60 26 L66 44 L84 36 L76 54 L94 60 L76 68 L84 84 L66 76 L60 94 L54 76 L36 84 L44 68 L26 60 L44 54 L36 36 L54 44 Z" fill="#FF6B3D"/>
  <text x="60" y="68" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke">BOUM</text>
</svg>`;

const HEARTS = [pic("coeur-vide.png"), pic("coeur.png")];
const heartSVG = full => HEARTS[full ? 1 : 0] ? `<img src="${HEARTS[full ? 1 : 0]}" alt="" draggable="false">` : `<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 20 C4 14 1.5 10 1.5 6.5 A5 5 0 0 1 12 4.5 A5 5 0 0 1 22.5 6.5 C22.5 10 20 14 12 20Z" fill="${full ? "#FF5A6E" : "#ffffff"}" stroke="${INK}" stroke-width="2"/></svg>`;

// Places des ballons dans l'aire de jeu (en %), sans qu'ils se chevauchent trop.
function spots(count) {
  for (let gap = 26; gap > 6; gap -= 3) {
    const list = [];
    for (let tries = 0; tries < 400 && list.length < count; tries++) {
      const p = { x: between(12, 88), y: between(16, 84) };
      if (list.every(q => Math.hypot(q.x - p.x, (q.y - p.y) * 0.9) > gap)) list.push(p);
    }
    if (list.length === count) return list;
  }
  return Array.from({ length: count }, (_, i) => ({ x: 12 + (i * 76) / Math.max(1, count - 1), y: 50 }));
}

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : MULTI;
  const players = solo
    ? [ctx.seats[0], ...rules.robots.map((force, k) => ({ ...SEATS[k + 1], kind: "robot", level: force, label: "Robot", art: robotArt(force), boost: 0, index: k + 1 }))]
    : ctx.seats;
  const N = players.length;
  const lives = players.map((p, i) => solo ? (i === 0 ? SOLO_LIVES : rules.robotLives) : LIVES);
  const outOrder = [];

  const node = h(`<div class="pc n${N}">
    ${players.map((p, i) => `
      <section class="pc-zone pos-${i} ${p.kind} ${(N === 2 && i === 1) || (N >= 3 && (i === 1 || i === 3)) ? "top" : ""}" style="--seat:${p.color};--seat-deep:${p.deep};--seat-soft:${p.soft}">
        <div class="pc-inner">
          <div class="pc-space"></div>
          <div class="pc-hint"></div>
          <div class="pc-arena"></div>
          <div class="pc-head"><span class="pc-avatar">${p.art}</span><span class="pc-name">${p.label}</span><span class="pc-hearts"></span></div>
        </div>
      </section>`).join("")}
    <div class="pc-bomb"><div class="pc-bomb-art">${bombSVG()}</div><div class="pc-boom">${boomSVG()}</div></div>
    <div class="pc-banner"></div>
  </div>`);
  root.append(node);
  const zones = [...node.querySelectorAll(".pc-zone")];
  const arenas = zones.map(z => z.querySelector(".pc-arena"));
  const hints = zones.map(z => z.querySelector(".pc-hint"));
  const bomb = node.querySelector(".pc-bomb");
  const fuse = bomb.querySelector(".pc-fuse");
  const fuseOut = bomb.querySelector(".pc-fuse-out");   // contour de la mèche du lot
  const spark = bomb.querySelector(".pc-spark");
  const banner = node.querySelector(".pc-banner");
  const fuseLength = 1;

  // Horloge du jeu (s'arrête pendant la pause) et petits rendez-vous.
  let clock = 0, events = [];
  const after = (delay, fn) => events.push({ time: clock + delay, fn });

  let phase = "intro", holder = -1, target = -1, flightEnd = 0, challenge = null, passes = 0, bombs = 0;
  let fuseTotal = 0, fuseShown = 0, burnt = 0, tickWait = 0, robotNext = 0;

  function renderHearts() {
    zones.forEach((z, i) => {
      z.querySelector(".pc-hearts").innerHTML = Array.from({ length: solo ? (i === 0 ? SOLO_LIVES : rules.robotLives) : LIVES }, (_, k) => heartSVG(k < lives[i])).join("");
      z.classList.toggle("out", lives[i] <= 0);
    });
  }

  const alive = () => players.map((_, i) => i).filter(i => lives[i] > 0);

  /* ---------- La bombe ---------- */

  // Où poser la bombe : dans la zone du joueur, du côté du centre de l'écran.
  function spotOf(i) {
    const box = node.getBoundingClientRect(), zone = zones[i].getBoundingClientRect();
    const size = bomb.offsetWidth || 90;
    const cx = Math.min(Math.max(box.left + box.width / 2, zone.left + size * 0.62), zone.right - size * 0.62);
    const cy = Math.min(Math.max(box.top + box.height / 2, zone.top + size * 0.62), zone.bottom - size * 0.62);
    return { x: cx - box.left, y: cy - box.top, turn: players[i].kind === "human" && zones[i].classList.contains("top") ? 180 : 0 };
  }
  function placeBomb(i) {
    const p = spotOf(i);
    bomb.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${p.turn}deg)`;
  }

  function newBomb() {
    const list = alive();
    const first = pickOne(list);
    const shrink = Math.pow(0.93, bombs);
    bombs++;
    fuseTotal = Math.max(6, between(...rules.fuse) * shrink);
    // La mèche dessinée ment un peu : la bombe peut exploser avant qu'elle soit finie.
    fuseShown = fuseTotal * between(1, 1.35);
    burnt = 0;
    tickWait = 0;
    bomb.classList.remove("boom", "hidden");
    bomb.classList.add("arrive");
    holder = first;
    placeBomb(first);
    zones.forEach((z, i) => z.classList.toggle("holding", i === first));
    phase = "hold";
    startChallenge(first);
    play("pop");
  }

  function throwBomb(from) {
    const others = alive().filter(i => i !== from);
    if (!others.length) return;
    target = pickOne(others);
    passes++;
    phase = "fly";
    flightEnd = clock + FLIGHT;
    zones[from].classList.remove("holding");
    bomb.classList.add("flying");
    placeBomb(target);
    play("go");
  }

  function land() {
    bomb.classList.remove("flying");
    holder = target;
    zones[holder].classList.add("holding");
    phase = "hold";
    startChallenge(holder);
  }

  function explode() {
    phase = "boom";
    const victim = holder;
    endChallenge(victim);
    lives[victim]--;
    if (lives[victim] <= 0) outOrder.push(victim);
    renderHearts();
    bomb.classList.add("boom");
    zones[victim].classList.add("burnt");
    setTimeout(() => zones[victim].classList.remove("burnt"), 700);
    play("trap");
    setTimeout(() => play("wrong"), 120);
    if (navigator.vibrate) navigator.vibrate(200);
    const left = alive();
    const humansLeft = left.filter(i => players[i].kind === "human");
    const over = left.length <= 1 || !humansLeft.length || (solo && lives[0] <= 0);
    after(1.6, () => {
      bomb.classList.add("hidden");
      zones[victim].classList.remove("holding");
      if (over) return finish();
      showBanner("Nouvelle bombe !");
      after(1.2, newBomb);
    });
  }

  function showBanner(message) {
    banner.textContent = message;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
  }

  /* ---------- Mini-défis ---------- */

  function startChallenge(i) {
    const p = players[i];
    const kind = pickOne(rules.kinds);
    // Les défis grandissent au fil des passes ; le coup de pouce les raccourcit.
    const size = Math.max(2, Math.min(rules.size + 2, rules.size + Math.floor(passes / 6)) - (p.boost || 0));
    const arena = arenas[i];
    arena.innerHTML = "";
    arena.className = `pc-arena ${kind}`;
    const ch = { kind, zone: i, size, lock: 0, items: [], step: 0, ready: true };
    challenge = ch;
    hints[i].textContent = HINT[kind] || "";
    if (kind === "ballons" || kind === "mouvants" || kind === "ordre") {
      const numbers = shuffle(Array.from({ length: size }, (_, k) => k + 1));
      spots(size).forEach((s, k) => {
        const color = kind === "ordre" ? "#B983FF" : pickOne(COLORS);
        const el = h(`<div class="pc-ball" style="left:${s.x}%;top:${s.y}%;--c:${color};--drift:${between(2.2, 3.4).toFixed(2)}s;--dx:${between(-30, 30).toFixed(0)}px;--dy:${between(-26, 26).toFixed(0)}px">${balloonHTML(kind === "ordre" ? numbers[k] : "", color)}</div>`);
        el.dataset.n = kind === "ordre" ? numbers[k] : 0;
        arena.append(el);
        ch.items.push(el);
      });
    } else if (kind === "couleur") {
      const [mine, word] = SEAT_BALL[p.name] || SEAT_BALL.Bleu;
      const decoys = COLORS.filter(c => c !== mine);
      const total = Math.min(9, size * 2);
      const list = shuffle([...Array(size).fill(mine), ...Array.from({ length: total - size }, () => pickOne(decoys))]);
      spots(total).forEach((s, k) => {
        const el = h(`<div class="pc-ball small" style="left:${s.x}%;top:${s.y}%;--c:${list[k]}">${balloonHTML("", list[k])}</div>`);
        el.dataset.good = list[k] === mine ? "1" : "";
        arena.append(el);
        ch.items.push(el);
      });
      hints[i].innerHTML = `Seulement les ballons <b style="color:${mine === "#FFD93D" ? "#9A7000" : mine}">${word}</b> !`;
    } else if (kind === "frappe") {
      ch.left = size * 3;
      const drum = pic("tambour.png");
      const el = h(`<div class="pc-drum ${drum ? "pictured" : ""}" ${drum ? `style="background-image:url('${drum}')"` : ""}><span class="pc-drum-count">${ch.left}</span></div>`);
      arena.append(el);
      ch.items.push(el);
    } else if (kind === "simon") {
      ch.sequence = Array.from({ length: Math.min(5, Math.max(3, size - 1)) }, () => Math.floor(Math.random() * 4));
      const pads = h(`<div class="pc-simon">${SIMON.map((c, k) => `<div class="pc-pad" data-k="${k}" style="--c:${c}"></div>`).join("")}</div>`);
      arena.append(pads);
      ch.items = [...pads.children];
      showSequence(ch, 0.5);
    }
    robotNext = clock + (ROBOT[p.level]?.react || 0.6) * between(0.8, 1.3);
  }

  function showSequence(ch, delay) {
    ch.ready = false;
    ch.step = 0;
    ch.items.forEach(el => el.classList.add("dim"));
    ch.sequence.forEach((k, n) => {
      after(delay + n * 0.62, () => { if (challenge === ch) { ch.items[k].classList.add("lit"); play("tick"); } });
      after(delay + n * 0.62 + 0.42, () => { if (challenge === ch) ch.items[k].classList.remove("lit"); });
    });
    after(delay + ch.sequence.length * 0.62, () => {
      if (challenge !== ch) return;
      ch.ready = true;
      ch.items.forEach(el => el.classList.remove("dim"));
      robotNext = clock + (ROBOT[players[ch.zone].level]?.react || 0.6);
    });
  }

  function endChallenge(i) {
    challenge = null;
    arenas[i].innerHTML = "";
    arenas[i].className = "pc-arena";
    hints[i].textContent = "";
  }

  // Un appui sur un élément du défi (par l'enfant ou par le robot).
  function hit(el) {
    const ch = challenge;
    if (!ch || phase !== "hold" || !ch.ready || clock < ch.lock || el.classList.contains("popped")) return;
    let good = true;
    if (ch.kind === "ordre") good = Number(el.dataset.n) === ch.step + 1;
    else if (ch.kind === "couleur") good = el.dataset.good === "1";
    else if (ch.kind === "simon") good = Number(el.dataset.k) === ch.sequence[ch.step];
    if (!good) return miss(ch, el);
    if (ch.kind === "frappe") {
      ch.left--;
      el.querySelector(".pc-drum-count").textContent = ch.left;
      el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
      play("tap");
      if (ch.left <= 0) return complete(ch);
      return;
    }
    if (ch.kind === "simon") {
      ch.step++;
      el.classList.add("lit");
      setTimeout(() => el.classList.remove("lit"), 180);
      play("tap");
      if (ch.step >= ch.sequence.length) complete(ch);
      return;
    }
    ch.step++;
    if (POP_PIC) el.innerHTML = `<img src="${POP_PIC}" alt="" draggable="false">`;
    el.classList.add("popped");
    play("pop");
    const remaining = ch.items.filter(item => !item.classList.contains("popped") && (ch.kind !== "couleur" || item.dataset.good === "1"));
    if (!remaining.length) complete(ch);
  }

  function miss(ch, el) {
    ch.lock = clock + 0.55;
    el.classList.remove("wrong"); void el.offsetWidth; el.classList.add("wrong");
    zones[ch.zone].classList.remove("shake"); void zones[ch.zone].offsetWidth; zones[ch.zone].classList.add("shake");
    play("wrong");
    if (ch.kind === "simon") showSequence(ch, 0.6);
  }

  function complete(ch) {
    const from = ch.zone;
    endChallenge(from);
    play("point");
    throwBomb(from);
  }

  // Le robot choisit quoi toucher.
  function robotTurn() {
    const ch = challenge;
    const p = players[ch.zone];
    const brain = ROBOT[p.level] || ROBOT[2];
    if (!ch.ready || clock < robotNext || clock < ch.lock) return;
    robotNext = clock + brain.tap * between(0.75, 1.25) * (ch.kind === "frappe" ? 0.42 : 1);
    const open = ch.items.filter(el => !el.classList.contains("popped"));
    let choice;
    if (ch.kind === "ordre") choice = open.find(el => Number(el.dataset.n) === ch.step + 1);
    else if (ch.kind === "couleur") choice = open.find(el => el.dataset.good === "1");
    else if (ch.kind === "simon") choice = ch.items[ch.sequence[ch.step]];
    else choice = open[0];
    if (Math.random() < brain.mistake && ch.kind !== "ballons" && ch.kind !== "mouvants" && ch.kind !== "frappe") {
      const wrong = ch.kind === "simon" ? ch.items.filter(el => el !== choice) : open.filter(el => el !== choice && (ch.kind !== "couleur" || el.dataset.good !== "1"));
      if (wrong.length) choice = pickOne(wrong);
    }
    if (choice) {
      choice.classList.add("robot-tap");
      hit(choice);
    }
  }

  /* ---------- Commandes ---------- */

  const onDown = event => {
    const el = event.target.closest(".pc-ball, .pc-drum, .pc-pad");
    if (!el) return;
    event.preventDefault();
    const zone = zones.findIndex(z => z.contains(el));
    if (zone < 0 || players[zone].kind !== "human" || !challenge || challenge.zone !== zone) return;
    hit(el);
  };
  node.addEventListener("pointerdown", onDown);

  /* ---------- Boucle ---------- */

  function update(dt) {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    if (phase === "fly" && clock >= flightEnd) land();
    if (phase === "hold") {
      burnt += dt;
      if (players[holder].kind === "robot" && challenge) robotTurn();
      // Tic-tac de plus en plus rapide.
      const left = 1 - burnt / fuseShown;
      tickWait -= dt;
      if (tickWait <= 0) { play("tick"); tickWait = left < 0.3 ? 0.28 : left < 0.55 ? 0.5 : 0.9; }
      if (burnt >= fuseTotal) explode();
    }
    if (phase === "hold" || phase === "fly") {
      const left = Math.max(0, 1 - burnt / fuseShown);
      fuse.style.strokeDasharray = `${left * fuseLength} 2`;
      if (fuseOut) fuseOut.style.strokeDasharray = `${left * fuseLength} 2`;
      const point = fuse.getPointAtLength ? fuse.getPointAtLength(left * fuse.getTotalLength()) : null;
      if (point) spark.setAttribute("transform", `translate(${point.x} ${point.y}) scale(${0.8 + Math.random() * 0.5})`);
      bomb.classList.toggle("hurry", left < 0.3);
      if (phase === "hold" && !bomb.classList.contains("flying")) placeBomb(holder);
    }
  }

  function finish() {
    phase = "done";
    if (solo) {
      const won = lives[0] > 0;
      const stars = won ? Math.max(1, Math.min(3, lives[0])) : 0;
      ctx.finish({
        solo: {
          stars, value: won ? lives[0] : 0, lowerIsBetter: false,
          format: v => `${v} cœur${v > 1 ? "s" : ""} gardé${v > 1 ? "s" : ""}`,
          label: won ? `Gagné avec ${lives[0]} cœur${lives[0] > 1 ? "s" : ""} !` : "La bombe a explosé trop souvent !",
          speech: won ? `Bravo ! Tu as gardé ${lives[0]} cœur${lives[0] > 1 ? "s" : ""} !` : "Boum ! Essaie encore !",
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : gagner en gardant ${stars + 1} cœur${stars ? "s" : ""}`
        }
      });
      return;
    }
    // Classement : les derniers en jeu d'abord, puis dans l'ordre inverse des explosions.
    const score = players.map((_, i) => lives[i] > 0 ? 100 + lives[i] : outOrder.indexOf(i));
    ctx.finish({ ranking: players.map((_, seat) => ({ seat, score: score[seat], label: lives[seat] > 0 ? `${lives[seat]} cœur${lives[seat] > 1 ? "s" : ""}` : "Boum !" })) });
  }

  const loop = createLoop(update);
  const onResize = () => { if (holder >= 0 && phase !== "fly") placeBomb(holder); };
  window.addEventListener("resize", onResize);

  return {
    start() {
      renderHearts();
      bomb.classList.add("hidden");
      showBanner("Attention…");
      say(solo ? "Renvoie la bombe avant qu'elle explose !" : "Attention, la bombe arrive !");
      after(2, newBomb);
      loop.start();
    },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); window.removeEventListener("resize", onResize); }
  };
}

/* ---------- Démonstration des règles ---------- */

function demo() {
  const node = h(`<div class="pc-demo">
    <div class="pc-demo-zone a"><span class="pc-demo-ball" style="--c:#FF6B6B">${balloonSVG()}</span><span class="pc-demo-ball" style="--c:#4D96FF">${balloonSVG()}</span><span class="pc-demo-ball" style="--c:#FFD93D">${balloonSVG()}</span></div>
    <div class="pc-demo-zone b"></div>
    <div class="pc-demo-bomb">${bombSVG()}</div>
  </div>`);
  return { node, stop() {} };
}

export default {
  id: "patate-chaude",
  title: "Patate chaude",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFE3D3", ink: "#A2401E" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="8" y="64" width="68" height="48" rx="12" fill="#DCE9FC" stroke="#2F80ED" stroke-width="4"/>
    <rect x="84" y="64" width="68" height="48" rx="12" fill="#FCDEDE" stroke="#EB5757" stroke-width="4"/>
    <ellipse cx="28" cy="86" rx="9" ry="10" fill="#FFD93D" stroke="#2B2350" stroke-width="2.5"/>
    <ellipse cx="52" cy="92" rx="9" ry="10" fill="#FF6B6B" stroke="#2B2350" stroke-width="2.5"/>
    <path d="M44 50 q36 -40 72 0" stroke="#A2401E" stroke-width="3" stroke-dasharray="6 6" fill="none"/>
    <circle cx="80" cy="40" r="20" fill="#3A3168" stroke="#2B2350" stroke-width="3"/>
    <circle cx="74" cy="41" r="4" fill="#fff"/><circle cx="86" cy="41" r="4" fill="#fff"/>
    <path d="M92 24 q8 -10 18 -6" stroke="#C9A36B" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="110" cy="18" r="6" fill="#FFC83D"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "La bombe passe de joueur en joueur. Quand elle est chez toi, réussis vite le petit défi pour la renvoyer ! Si elle explose chez toi, tu perds un cœur."
      : "La bombe passe de joueur en joueur. Quand elle est dans ta zone, réussis vite le petit défi pour la renvoyer ! Si elle explose chez toi, tu perds un cœur. Le dernier qui a encore des cœurs gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
