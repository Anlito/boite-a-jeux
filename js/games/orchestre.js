// L'orchestre : les instruments jouent une suite de notes en couleur ; il faut la rejouer dans le même ordre.
// Seul : la suite s'allonge d'une note à chaque fois. À plusieurs, chacun son tour : on rejoue toute la
// suite, puis on ajoute sa propre note pour le joueur suivant. Une erreur coûte un cœur.
import { play, say, music } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createLoop } from "../core/stage.js";
import { hasImage, imagePath } from "../core/art.js";

// Les instruments : couleur, dessin, note (gamme pentatonique : toutes les notes vont bien ensemble), timbre.
const INSTRUMENTS = [
  { name: "piano", emoji: "🎹", color: "#EB5757", deep: "#BE3434", freq: 262, type: "triangle" },
  { name: "tambour", emoji: "🥁", color: "#2F80ED", deep: "#1C5DB8", freq: 330, type: "square" },
  { name: "trompette", emoji: "🎺", color: "#F2C94C", deep: "#9A7000", freq: 392, type: "sawtooth" },
  { name: "guitare", emoji: "🎸", color: "#27AE60", deep: "#18804A", freq: 440, type: "triangle" },
  { name: "saxophone", emoji: "🎷", color: "#B983FF", deep: "#7B4FC8", freq: 523, type: "cloche" },
  { name: "violon", emoji: "🎻", color: "#FF9F43", deep: "#C96A12", freq: 587, type: "sine" }
];
const LIVES = 2;

// Niveaux solo : nombre d'instruments, vitesse (secondes par note), longueur de départ,
// longueur à atteindre pour 1, 2, 3 étoiles, instruments qui changent de place.
const LEVELS = [
  { pads: 3, tempo: 0.75, start: 2, stars: [4, 6, 8], shuffle: false, goal: "Écoute et regarde les instruments, puis rejoue la même suite !" },
  { pads: 4, tempo: 0.72, start: 2, stars: [5, 7, 9], shuffle: false, goal: "Quatre instruments maintenant." },
  { pads: 4, tempo: 0.65, start: 3, stars: [6, 8, 10], shuffle: false, goal: "La musique va un peu plus vite." },
  { pads: 4, tempo: 0.6, start: 3, stars: [6, 9, 11], shuffle: false, goal: "Une longue chanson ! Retiens bien l'ordre." },
  { pads: 5, tempo: 0.62, start: 3, stars: [6, 9, 11], shuffle: false, goal: "Le saxophone rejoint l'orchestre !" },
  { pads: 5, tempo: 0.55, start: 3, stars: [7, 10, 12], shuffle: false, goal: "Cinq instruments, plus vite." },
  { pads: 4, tempo: 0.6, start: 3, stars: [6, 8, 10], shuffle: true, goal: "Attention : les instruments changent de place à chaque chanson !" },
  { pads: 6, tempo: 0.58, start: 3, stars: [7, 10, 12], shuffle: false, goal: "Le violon arrive : six instruments !" },
  { pads: 5, tempo: 0.5, start: 4, stars: [8, 11, 13], shuffle: true, goal: "Vite, et les instruments bougent !" },
  { pads: 6, tempo: 0.45, start: 4, stars: [9, 12, 15], shuffle: true, goal: "Le défi des champions : le grand orchestre !" }
];
const FREE = { pads: 6, tempo: 0.55, start: 3, stars: [8, 11, 14], shuffle: false };
const MULTI = { pads: 4, tempo: 0.6 };
// Robot : chance de bien se souvenir de chaque note (baisse un peu quand la suite s'allonge).
const ROBOT = { 1: 0.9, 2: 0.95, 3: 0.985 };

// Images du lot 19 : instruments (sinon les emojis), note qui s'envole, scène de théâtre.
const PICTURED = INSTRUMENTS.every(I => hasImage(`orchestre/${I.name}.png`));
const art = I => PICTURED
  ? `<img src="${imagePath(`orchestre/${I.name}.png`)}" alt="" draggable="false">`
  : `<span>${I.emoji}</span>`;
const NOTE = hasImage("orchestre/note.png") ? imagePath("orchestre/note.png") : null;
// Adresse complète : dans une variable CSS, un chemin relatif serait lu depuis le dossier css/.
const SCENE = hasImage("orchestre/fond-scene.jpg") ? new URL(imagePath("orchestre/fond-scene.jpg"), document.baseURI).href : null;

const pickOne = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : MULTI;
  const players = ctx.seats.map((p, i) => ({ seat: i, p, lives: LIVES, out: false, best: 0 }));
  let order = INSTRUMENTS.slice(0, rules.pads).map((_, i) => i);   // instrument posé sur chaque place

  const node = h(`<div class="or n${rules.pads}${PICTURED ? " pictured" : ""}"${SCENE ? ` style="--scene:url('${SCENE}')"` : ""}>
    <div class="or-top"><div class="or-players">${players.map(pl => `<span class="or-player" data-seat="${pl.seat}" style="--seat:${pl.p.color};--seat-deep:${pl.p.deep}">
      <span class="or-avatar">${pl.p.art}</span><span class="or-name">${pl.p.label}</span><span class="or-hearts"></span></span>`).join("")}</div></div>
    <div class="or-stage">
      <div class="or-ring"></div>
      <div class="or-center"><span class="or-count"></span><span class="or-say"></span></div>
    </div>
  </div>`);
  root.append(node);
  const ring = node.querySelector(".or-ring");
  const count = node.querySelector(".or-count");
  const sayBox = node.querySelector(".or-say");

  let seq = [], step = 0, phase = "intro", turn = 0, clock = 0, events = [], robotAt = 0, robotStep = 0, failed = false, adding = false;
  const after = (delay, fn) => events.push({ time: clock + delay, fn });

  function renderPads() {
    const n = rules.pads;
    ring.innerHTML = order.map((ins, place) => {
      const a = -Math.PI / 2 + place * Math.PI * 2 / n, I = INSTRUMENTS[ins];
      return `<button class="or-pad" data-ins="${ins}" style="--x:${(50 + Math.cos(a) * 36).toFixed(1)}%;--y:${(50 + Math.sin(a) * 36).toFixed(1)}%;--c:${I.color};--d:${I.deep}" aria-label="${I.name}">${art(I)}</button>`;
    }).join("");
  }
  const padOf = ins => ring.querySelector(`.or-pad[data-ins="${ins}"]`);

  function renderPlayers() {
    node.querySelectorAll(".or-player").forEach(el => {
      const pl = players[Number(el.dataset.seat)];
      el.classList.toggle("turn", !solo && pl.seat === turn && !pl.out);
      el.classList.toggle("out", pl.out);
      el.querySelector(".or-hearts").textContent = "♥".repeat(Math.max(0, pl.lives)) + "♡".repeat(LIVES - Math.max(0, pl.lives));
    });
    count.textContent = solo ? `${seq.length} note${seq.length > 1 ? "s" : ""}` : seq.length ? `${seq.length} note${seq.length > 1 ? "s" : ""}` : "";
  }

  function light(ins, long = false) {
    const pad = padOf(ins), I = INSTRUMENTS[ins];
    if (!pad) return;
    pad.classList.remove("lit"); void pad.offsetWidth; pad.classList.add("lit");
    setTimeout(() => pad.classList.remove("lit"), long ? 420 : 260);
    music(I.freq, long ? 0.45 : 0.3, I.type);
    // Une note s'envole de l'instrument qui joue.
    if (NOTE) {
      const note = h(`<img class="or-note" src="${NOTE}" alt="" draggable="false" style="--x:${pad.style.getPropertyValue("--x")};--y:${pad.style.getPropertyValue("--y")};--drift:${(Math.random() * 2 - 1).toFixed(2)}">`);
      ring.append(note);
      setTimeout(() => note.remove(), 1000);
    }
  }

  function setSay(text) { sayBox.textContent = text; }

  /* ---------- Solo : l'orchestre joue, l'enfant rejoue ---------- */

  function soloRound() {
    if (rules.shuffle && seq.length) { order = shuffle(order); renderPads(); }
    if (!seq.length) seq = Array.from({ length: rules.start }, () => pickOne(order));
    else seq.push(pickOne(order));
    renderPlayers();
    showSequence(() => { phase = "input"; step = 0; setSay("À toi !"); });
  }

  // L'orchestre joue la suite, une note après l'autre.
  function showSequence(done) {
    phase = "show";
    setSay("Écoute…");
    ring.classList.add("listening");
    const gap = rules.tempo;
    seq.forEach((ins, k) => after(0.6 + k * gap, () => light(ins, true)));
    after(0.6 + seq.length * gap, () => { ring.classList.remove("listening"); done(); });
  }

  /* ---------- À plusieurs : rejouer, puis ajouter une note ---------- */

  function multiTurn() {
    const alive = players.filter(pl => !pl.out);
    if (alive.length <= 1 || (alive.every(pl => pl.p.kind === "robot") && players.some(pl => pl.p.kind === "human"))) return finish();
    while (players[turn].out) turn = (turn + 1) % players.length;
    const pl = players[turn];
    renderPlayers();
    step = 0; adding = !seq.length; failed = false;
    const start = () => {
      phase = "input";
      setSay(adding ? `${pl.p.label}, choisis la première note !` : `${pl.p.label}, rejoue la chanson !`);
      if (pl.p.kind === "robot") { robotAt = clock + 0.9; robotStep = 0; }
    };
    say(adding ? `${pl.p.label}, à toi de commencer !` : `À toi, ${pl.p.label} !`);
    // Coup de pouce : le petit réentend la chanson avant de la rejouer.
    if (seq.length && (pl.p.boost || 0) > 0) showSequence(start);
    else { phase = "wait"; after(0.9, start); }
  }

  function nextPlayer() {
    turn = (turn + 1) % players.length;
    after(1.1, multiTurn);
  }

  /* ---------- Appuis ---------- */

  function tap(ins) {
    if (phase !== "input") return;
    light(ins);
    if (!solo && adding) {
      // On ajoute sa note : elle devient la dernière de la chanson.
      seq.push(ins);
      phase = "wait";
      play("star");
      setSay("Note ajoutée !");
      players[turn].best = Math.max(players[turn].best, seq.length);
      renderPlayers();
      nextPlayer();
      return;
    }
    if (ins !== seq[step]) return mistake();
    step++;
    if (step < seq.length) return;
    // Chanson rejouée en entier !
    if (solo) {
      phase = "wait";
      play("point");
      setSay(seq.length >= rules.stars[2] ? "Bravo, maestro !" : "Bravo !");
      players[0].best = seq.length;
      if (level && seq.length >= rules.stars[2]) return after(1.2, finish);
      after(1.1, soloRound);
    } else {
      adding = true;
      play("point");
      setSay("Bravo ! Ajoute une note !");
      if (players[turn].p.kind === "robot") robotAt = clock + 0.8;
    }
  }

  function mistake() {
    const pl = players[turn];
    phase = "wait";
    play("wrong");
    ring.classList.add("oops"); setTimeout(() => ring.classList.remove("oops"), 500);
    // Montrer la bonne note.
    const right = seq[step];
    after(0.5, () => light(right, true));
    pl.lives--;
    if (pl.lives <= 0) pl.out = true;
    renderPlayers();
    if (solo) {
      if (pl.out) { setSay("Fin du concert !"); return after(1.4, finish); }
      setSay("Oups ! Encore une fois…");
      return after(1.4, () => showSequence(() => { phase = "input"; step = 0; setSay("À toi !"); }));
    }
    setSay(pl.out ? `${pl.p.label} quitte l'orchestre !` : `Oups ! ${pl.p.label} perd un cœur.`);
    nextPlayer();
  }

  function finish() {
    phase = "done";
    if (solo) {
      // Longueur de la plus longue chanson rejouée en entier.
      const best = players[0].best;
      const stars = rules.stars.filter(need => best >= need).length;
      ctx.finish({
        solo: {
          stars, value: best, lowerIsBetter: false,
          format: v => `${v} note${v > 1 ? "s" : ""}`,
          label: `Chanson de ${best} note${best > 1 ? "s" : ""} rejouée`,
          speech: stars === 3 ? "Quel musicien !" : `Une chanson de ${best} notes !`,
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : rejouer ${rules.stars[stars]} notes`
        }
      });
      return;
    }
    // Les derniers dans l'orchestre gagnent ; puis ceux qui ont le plus de cœurs.
    ctx.finish({ ranking: players.map(pl => ({ seat: pl.seat, score: (pl.out ? 0 : 10) + pl.lives, label: pl.out ? "Sorti" : `${pl.lives} cœur${pl.lives > 1 ? "s" : ""}` })) });
  }

  const onDown = event => {
    const pad = event.target.closest(".or-pad");
    if (!pad || phase !== "input" || players[turn].p.kind !== "human") return;
    event.preventDefault();
    tap(Number(pad.dataset.ins));
  };
  node.addEventListener("pointerdown", onDown);

  const loop = createLoop(dt => {
    clock += dt;
    const due = events.filter(e => e.time <= clock);
    events = events.filter(e => e.time > clock);
    due.forEach(e => e.fn());
    // Robot : il rejoue la chanson (avec sa mémoire), puis ajoute une note au hasard.
    if (!solo && phase === "input" && players[turn].p.kind === "robot" && clock >= robotAt) {
      robotAt = clock + rules.tempo * 0.9;
      if (adding) return tap(pickOne(order));
      const memory = Math.pow(ROBOT[players[turn].p.level] || ROBOT[2], 1 + seq.length / 10);
      tap(Math.random() < memory ? seq[step] : pickOne(order.filter(i => i !== seq[step])));
    }
  });

  return {
    start() {
      renderPads();
      renderPlayers();
      loop.start();
      say(solo ? "Écoute bien l'orchestre !" : "Chacun son tour : rejoue la chanson, puis ajoute une note !");
      after(1.2, solo ? soloRound : multiTurn);
    },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); }
  };
}

function demo() {
  const node = h(`<div class="or-demo${PICTURED ? " pictured" : ""}">${INSTRUMENTS.slice(0, 4).map((I, k) => `<span style="--c:${I.color};--k:${k}">${PICTURED ? art(I) : I.emoji}</span>`).join("")}</div>`);
  return { node, stop() {} };
}

export default {
  id: "orchestre",
  title: "L'orchestre",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#FFEFD6", ink: "#8A4A00" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <circle cx="80" cy="60" r="44" fill="#FFF8E0" stroke="#2B2350" stroke-width="3"/>
    <circle cx="80" cy="26" r="15" fill="#EB5757" stroke="#2B2350" stroke-width="3"/><circle cx="114" cy="60" r="15" fill="#2F80ED" stroke="#2B2350" stroke-width="3"/>
    <circle cx="80" cy="94" r="15" fill="#F2C94C" stroke="#2B2350" stroke-width="3"/><circle cx="46" cy="60" r="15" fill="#27AE60" stroke="#2B2350" stroke-width="3"/>
    <path d="M72 52 v14 a5 5 0 1 1 -3 -4 v-14 l14 -3 v12 a5 5 0 1 1 -3 -4 v-7z" fill="#2B2350"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "L'orchestre joue une petite chanson : écoute et regarde bien les instruments, puis rejoue-la dans le même ordre ! Elle s'allonge à chaque fois."
      : "Chacun son tour : rejoue toute la chanson, puis ajoute ta note pour le suivant. Une erreur, et tu perds un cœur ! Le dernier musicien gagne.",
    demo
  },
  levels: LEVELS,
  mount
};
