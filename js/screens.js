// Les écrans communs à tous les jeux : accueil, joueurs, règles, partie, podium.
import { GAMES, gameById } from "./games/index.js";
import { store } from "./core/store.js";
import { play, say } from "./core/sound.js";
import { h, on, modal, iconButton, describeSeat } from "./core/ui.js";
import { enterGameOrientation } from "./core/orientation.js";
import { PACK_PRICE } from "./core/stickers.js";
export { album } from "./album.js";

// Pièces gagnées : au moins une par partie, une par étoile, et un bonus pour un record ou une victoire.
const coinsLine = (amount, extra = "") => `<span class="coins-won">+${amount} ${iconArt("piece")}${extra}</span>`;
import { SEATS, AVATARS, ROBOTS, avatarArt, robotArt, mascotArt, icon, iconArt, starSVG, peopleArt, shapeSVG, hasImage, imagePath } from "./core/art.js";

const stars = (count, total = 3) => `<span class="stars">${Array.from({ length: total }, (_, i) => starSVG(i < count)).join("")}</span>`;

function topBar(title, backLabel = "Retour") {
  return `<header class="bar">${iconButton("retour", backLabel, "back")}<h2>${title}</h2><span class="bar-space"></span></header>`;
}

/* ---------- Accueil ---------- */

export function home(app) {
  const cards = GAMES.map(game => {
    const best = store.bestStars(game.id);
    const counts = [1, 2, 3, 4].map(n => `<span class="pill ${n >= game.players.min && n <= game.players.max ? "" : "off"}">${n}</span>`).join("");
    return `<button class="game-card" data-game="${game.id}" style="--theme:${game.theme.bg};--theme-ink:${game.theme.ink}">
      <span class="game-art">${hasImage(`vignettes/${game.id}.jpg`) ? `<img class="vignette" src="${imagePath(`vignettes/${game.id}.jpg`)}" alt="" draggable="false">` : game.vignette()}</span>
      <span class="game-name">${game.title}</span>
      <span class="game-meta"><span class="pills" aria-label="De ${game.players.min} à ${game.players.max} joueurs">${counts}</span>${stars(best)}</span>
    </button>`;
  }).join("");
  const node = h(`<main class="screen home">
    <header class="home-top">
      <span class="home-mascot">${mascotArt("salut")}</span>
      <h1>La boîte <span>à jeux</span></h1>
      <button class="album-btn ${store.profiles.some(p => (p.coins || 0) >= PACK_PRICE) ? "ready" : ""}" aria-label="Mon album d'autocollants">${iconArt("etoile-pleine")}<span>Album</span></button>
      ${iconButton("reglages", "Réglages", "settings")}
    </header>
    <section class="shelf">${cards}
      <div class="game-card soon" aria-label="D'autres jeux arrivent bientôt">
        <span class="soon-dots"><i></i><i></i><i></i></span>
        <span class="game-name">D'autres jeux arrivent</span>
      </div>
    </section>
  </main>`);
  on(node, "[data-game]", "click", (_, card) => app.go("count", { game: gameById(card.dataset.game) }));
  node.querySelector(".settings").addEventListener("click", () => openSettings(app));
  node.querySelector(".album-btn").addEventListener("click", () => app.go("album"));
  return { node };
}

function openSettings(app) {
  const content = h(`<div class="settings-panel">
    <h3>Réglages</h3>
    <label class="toggle"><span>${icon("son-on")} Bruitages</span><input type="checkbox" data-setting="sound"></label>
    <label class="toggle"><span>${icon("personnes")} Voix qui lit les règles</span><input type="checkbox" data-setting="voice"></label>
    <h4>Joueurs</h4>
    <div class="people-list"></div>
    <button class="btn wide close-settings">Fermer</button>
  </div>`);
  const list = content.querySelector(".people-list");
  // Liste des joueurs, avec une poubelle ; la suppression demande une confirmation.
  function renderPeople(asking = null) {
    if (!store.profiles.length) { list.innerHTML = `<p class="hint">Aucun joueur pour l’instant.</p>`; return; }
    list.innerHTML = store.profiles.map(p => {
      const stickers = Object.keys(p.stickers || {}).length;
      if (p.id === asking) return `<div class="person-row asking">
        <p>Supprimer <b>${p.name}</b> ? Ses pièces et ses autocollants seront perdus.</p>
        <div class="person-confirm"><button class="btn keep" data-keep>Non</button><button class="btn danger" data-remove="${p.id}">${icon("poubelle")} Supprimer</button></div>
      </div>`;
      return `<div class="person-row"><span class="person-art">${avatarArt(p.avatar)}</span>
        <span class="person-name">${p.name}<small>${p.coins || 0} pièce${(p.coins || 0) > 1 ? "s" : ""} · ${stickers} autocollant${stickers > 1 ? "s" : ""}</small></span>
        <button class="icon-btn small" data-ask="${p.id}" aria-label="Supprimer ${p.name}" title="Supprimer ${p.name}">${icon("poubelle")}</button>
      </div>`;
    }).join("");
    on(list, "[data-ask]", "click", (_, b) => renderPeople(b.dataset.ask));
    on(list, "[data-keep]", "click", () => renderPeople());
    on(list, "[data-remove]", "click", (_, b) => { store.removeProfile(b.dataset.remove); renderPeople(); });
  }
  renderPeople();
  content.querySelectorAll("[data-setting]").forEach(input => {
    input.checked = store.settings[input.dataset.setting];
    input.addEventListener("change", () => store.setting(input.dataset.setting, input.checked));
  });
  const dialog = modal(content);
  content.querySelector(".close-settings").addEventListener("click", () => { dialog.close(); if (document.querySelector(".screen.home")) app.go("home"); });
}

/* ---------- Combien de joueurs ? ---------- */

export function count(app, { game }) {
  const buttons = [1, 2, 3, 4].map(n => {
    const ok = n >= game.players.min && n <= game.players.max;
    return `<button class="count-btn" data-count="${n}" ${ok ? "" : "disabled"} aria-label="${n} joueur${n > 1 ? "s" : ""}">
      <span class="count-art">${peopleArt(n, "currentColor")}</span><span class="count-num">${n}</span></button>`;
  }).join("");
  const node = h(`<main class="screen setup">${topBar(game.title, "Retour à l'accueil")}
    <p class="ask">Combien de joueurs ?</p>
    <section class="count-grid">${buttons}</section>
  </main>`);
  node.querySelector(".back").addEventListener("click", () => app.go("home"));
  on(node, "[data-count]", "click", (_, button) => app.go("who", { game, count: Number(button.dataset.count) }));
  return { node, ready: () => say("Combien de joueurs ?") };
}

/* ---------- Qui joue ? ---------- */

export function who(app, { game, count }) {
  const last = store.lastSetup(game.id);
  const seats = Array.from({ length: count }, (_, i) => {
    const previous = last?.seats?.[i];
    if (previous?.kind === "robot" && count > 1) return { ...previous };
    if (previous?.kind === "human" && store.profile(previous.profileId)) return { ...previous };
    return null;
  });
  // Un profil ne peut occuper qu'une place.
  seats.forEach((seat, i) => {
    if (seat?.kind === "human" && seats.findIndex(s => s?.profileId === seat.profileId) !== i) seats[i] = null;
  });

  const node = h(`<main class="screen setup">${topBar("Qui joue ?", "Retour au nombre de joueurs")}
    <section class="seat-grid n${count}"></section>
    <button class="btn primary go-btn" disabled>${icon("lecture")} Jouer</button>
  </main>`);
  const grid = node.querySelector(".seat-grid");
  const goButton = node.querySelector(".go-btn");

  function render() {
    grid.innerHTML = seats.map((seat, i) => {
      const info = describeSeat(seat, i);
      const boost = info.kind === "human" && count > 1 ? `
        <div class="boost" aria-label="Coup de pouce">
          <span class="boost-label">${icon("eclair")} Coup de pouce</span>
          <span class="boost-steps">${[0, 1, 2].map(level => `<button class="boost-step ${info.boost >= level && level > 0 ? "on" : ""} ${info.boost === level ? "current" : ""}" data-seat="${i}" data-boost="${level}" aria-label="${["Aucun", "Petit", "Grand"][level]} coup de pouce">${level === 0 ? "0" : icon("eclair").repeat(level)}</button>`).join("")}</span>
        </div>` : "";
      return `<article class="seat ${info.kind}" style="--seat:${info.color};--seat-deep:${info.deep};--seat-soft:${info.soft}">
        <span class="seat-shape">${shapeSVG(info.shape, info.color)}</span>
        <button class="seat-pick" data-seat="${i}" aria-label="Choisir le joueur ${info.seatName}">
          <span class="seat-art">${info.art || icon("plus")}</span>
          <span class="seat-name">${info.kind === "empty" ? "Choisir" : info.label}</span>
        </button>${boost}
      </article>`;
    }).join("");
    on(grid, ".seat-pick", "click", (_, button) => pick(Number(button.dataset.seat)));
    on(grid, ".boost-step", "click", (_, button) => {
      seats[Number(button.dataset.seat)].boost = Number(button.dataset.boost);
      render();
    });
    const ready = seats.every(Boolean) && seats.some(seat => seat.kind === "human");
    goButton.disabled = !ready;
  }

  function pick(index) {
    const colors = SEATS[index];
    const taken = seats.filter((seat, i) => i !== index && seat?.kind === "human").map(seat => seat.profileId);
    const people = store.profiles.filter(p => !taken.includes(p.id)).map(p => `
      <button class="choice" data-profile="${p.id}"><span class="choice-art">${avatarArt(p.avatar)}</span><span>${p.name}</span></button>`).join("");
    const robots = count > 1 && game.robots ? [1, 2, 3].map(level => `
      <button class="choice robot" data-robot="${level}"><span class="choice-art">${robotArt(level)}</span><span>${ROBOTS[level].short}</span></button>`).join("") : "";
    const content = h(`<div class="picker" style="--seat:${colors.color};--seat-soft:${colors.soft}">
      <h3><span class="dot">${shapeSVG(colors.shape, colors.color)}</span> Qui joue en ${colors.name} ?</h3>
      <div class="choices">${people}<button class="choice new"><span class="choice-art">${icon("plus")}</span><span>Nouveau</span></button></div>
      ${robots ? `<h4>Ou un robot</h4><div class="choices">${robots}</div>` : ""}
    </div>`);
    const dialog = modal(content);
    on(content, "[data-profile]", "click", (_, button) => {
      seats[index] = { kind: "human", profileId: button.dataset.profile, boost: 0 };
      dialog.close();
      render();
    });
    on(content, "[data-robot]", "click", (_, button) => {
      seats[index] = { kind: "robot", level: Number(button.dataset.robot) };
      dialog.close();
      render();
    });
    content.querySelector(".new").addEventListener("click", () => {
      dialog.close();
      createProfile(profile => {
        seats[index] = { kind: "human", profileId: profile.id, boost: 0 };
        render();
      });
    });
  }

  goButton.addEventListener("click", () => {
    const session = { game, count, seats: seats.map(seat => ({ ...seat })) };
    store.rememberSetup(game.id, { count, seats: session.seats });
    app.go(count === 1 && game.levels ? "levels" : "rules", { session });
  });
  node.querySelector(".back").addEventListener("click", () => app.go("count", { game }));
  render();
  return { node, ready: () => say(seats.every(Boolean) ? "C'est bon ? Appuie sur Jouer !" : "Qui joue ? Touche une place pour choisir.") };
}

function createProfile(done) {
  let chosen = null;
  const used = new Set(store.profiles.map(p => p.avatar));
  const content = h(`<div class="new-profile">
    <h3>Nouveau joueur</h3>
    <p class="hint">Choisis ton animal</p>
    <div class="choices avatars">${Object.entries(AVATARS).map(([id, a]) => `
      <button class="choice ${used.has(id) ? "used" : ""}" data-avatar="${id}" aria-label="${a.label}"><span class="choice-art">${avatarArt(id)}</span></button>`).join("")}</div>
    <label class="name-field"><span>Prénom (facultatif)</span><input maxlength="14" autocomplete="off" enterkeyhint="done"></label>
    <button class="btn primary wide" disabled>C'est moi !</button>
  </div>`);
  const input = content.querySelector("input");
  const confirm = content.querySelector(".btn");
  const dialog = modal(content);
  on(content, "[data-avatar]", "click", (_, button) => {
    chosen = button.dataset.avatar;
    content.querySelectorAll("[data-avatar]").forEach(b => b.classList.toggle("selected", b === button));
    input.placeholder = AVATARS[chosen].label;
    confirm.disabled = false;
    play("pop");
  });
  confirm.addEventListener("click", () => {
    const name = input.value.trim() || AVATARS[chosen].label;
    const profile = store.addProfile(chosen, name.charAt(0).toUpperCase() + name.slice(1));
    dialog.close();
    done(profile);
  });
  say("Choisis ton animal !");
}

/* ---------- Niveaux (solo) ---------- */

// Le mode libre (le défi sans fin) s'ouvre quand le niveau FREE_AFTER a au moins une étoile.
const FREE_AFTER = 5;

export function levels(app, { session }) {
  const { game } = session;
  const profileId = session.seats[0].profileId;
  const done = store.levelStars(profileId, game.id);
  const unlocked = i => i === 0 || (done[i - 1] || 0) >= 1;
  const freeOpen = (done[FREE_AFTER - 1] || 0) >= 1;
  const next = game.levels.findIndex((_, i) => unlocked(i) && !done[i]);
  const node = h(`<main class="screen levels">${topBar(game.title, "Retour au choix des joueurs")}
    <p class="ask">Choisis ton niveau</p>
    <section class="level-grid">${game.levels.map((level, i) => unlocked(i) ? `
      <button class="level-tile ${i === next ? "next" : ""}" data-level="${i}" aria-label="Niveau ${i + 1}">
        <span class="level-num">${i + 1}</span>${stars(done[i] || 0)}
      </button>` : `
      <span class="level-tile locked" aria-label="Niveau ${i + 1} fermé">${iconArt("cadenas")}<span class="level-num">${i + 1}</span></span>`).join("")}
      ${freeOpen ? `<button class="level-tile free" data-level="libre"><span class="level-num">∞</span><span class="level-free">Défi libre</span></button>`
        : `<span class="level-tile free locked">${iconArt("cadenas")}<span class="level-free">Défi libre</span><small>Niveau ${FREE_AFTER} pour l'ouvrir</small></span>`}
    </section>
  </main>`);
  node.querySelector(".back").addEventListener("click", () => app.go("who", { game, count: 1 }));
  on(node, "[data-level]", "click", (_, tile) => {
    const level = tile.dataset.level === "libre" ? "libre" : Number(tile.dataset.level);
    app.go("rules", { session: { ...session, level } });
  });
  return { node, ready: () => say("Choisis ton niveau !") };
}

const levelOf = session => typeof session.level === "number" ? session.game.levels[session.level] : null;

/* ---------- Règles ---------- */

export function rules(app, { session }) {
  const { game } = session;
  const level = levelOf(session);
  const text = level ? `Niveau ${session.level + 1}. ${level.goal}` : game.rules.text(session);
  const node = h(`<main class="screen rules">${topBar(game.title, "Retour au choix des joueurs")}
    <section class="rules-stage">
      <div class="rules-demo"></div>
      <div class="rules-talk"><span class="rules-mascot">${mascotArt("explique")}</span><p class="bubble">${text}</p></div>
    </section>
    <button class="btn primary go-btn">${icon("lecture")} C'est parti !</button>
  </main>`);
  const demo = game.rules.demo(session);
  node.querySelector(".rules-demo").append(demo.node);
  node.querySelector(".back").addEventListener("click", () => session.level !== undefined ? app.go("levels", { session }) : app.go("who", { game, count: session.count }));
  node.querySelector(".go-btn").addEventListener("click", () => app.go("play", { session }));
  node.querySelector(".bubble").addEventListener("click", () => say(text));
  return { node, ready: () => say(text), leave: () => demo.stop?.() };
}

/* ---------- Partie ---------- */

// Exporté sous le nom « play » (le nom « play » est déjà pris par le son).
export { playScreen as play };

function playScreen(app, { session }) {
  const { game } = session;
  const node = h(`<main class="screen play">
    <div class="play-root"></div>
    <button class="hold-pause" aria-label="Pause (garder le doigt appuyé)" title="Pause : garder le doigt appuyé">
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="ring" cx="20" cy="20" r="17"/></svg>${iconArt("pause")}
    </button>
  </main>`);
  const seats = session.seats.map((seat, i) => ({ ...describeSeat(seat, i), index: i }));
  let finished = false;
  const instance = game.mount(node.querySelector(".play-root"), {
    seats,
    count: session.count,
    level: levelOf(session),
    finish(result) {
      if (finished) return;
      finished = true;
      setTimeout(() => app.go("podium", { session, result }), 900);
    }
  });

  // Pause : un appui long, pour éviter les pauses accidentelles en pleine partie.
  const holdButton = node.querySelector(".hold-pause");
  let holdTimer = null;
  const cancelHold = () => { clearTimeout(holdTimer); holdButton.classList.remove("holding"); };
  holdButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    holdButton.classList.add("holding");
    holdTimer = setTimeout(() => { cancelHold(); pause(); }, 650);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(type => holdButton.addEventListener(type, cancelHold));
  holdButton.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") pause(); });

  let paused = false;
  function pause() {
    if (paused || finished) return;
    paused = true;
    instance.pause?.();
    const content = h(`<div class="pause-panel"><span class="pause-mascot">${mascotArt("surprise")}</span><h3>Pause</h3>
      <button class="btn primary wide resume">${icon("lecture")} Reprendre</button>
      <button class="btn wide restart">${icon("rejouer")} Recommencer</button>
      <button class="btn wide quit">${icon("accueil")} Accueil</button></div>`);
    const dialog = modal(content, { onClose: () => { if (paused) resume(); } });
    content.querySelector(".resume").addEventListener("click", () => dialog.close());
    content.querySelector(".restart").addEventListener("click", () => { paused = false; app.go("play", { session }); });
    content.querySelector(".quit").addEventListener("click", () => { paused = false; app.go("home"); });
  }
  function resume() {
    paused = false;
    instance.resume?.();
  }
  const onHidden = () => { if (document.hidden) pause(); };
  document.addEventListener("visibilitychange", onHidden);
  const onKey = event => { if (event.key === "Escape") pause(); };
  document.addEventListener("keydown", onKey);

  // L'écran ne doit pas s'éteindre pendant une partie.
  let wakeLock = null;
  navigator.wakeLock?.request("screen").then(lock => { wakeLock = lock; }).catch(() => {});

  let leaveOrientation = null;
  return {
    node,
    ready() {
      leaveOrientation = enterGameOrientation(game.orientation);
      instance.start();
    },
    leave() {
      instance.destroy();
      leaveOrientation?.();
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("keydown", onKey);
      wakeLock?.release().catch(() => {});
    }
  };
}

/* ---------- Podium ---------- */

export function podium(app, { session, result }) {
  const { game } = session;
  const seats = session.seats.map((seat, i) => ({ ...describeSeat(seat, i), index: i }));
  const solo = session.count === 1;
  let headline, body, mood = "bravo", packReady = false, nextLevel = null;

  if (solo) {
    const player = seats[0];
    // En niveau : on garde les étoiles du niveau ; le record (temps, score) ne vaut que pour le défi libre.
    const inLevel = typeof session.level === "number";
    const saved = store.record(player.profile.id, game.id, inLevel
      ? { stars: result.solo.stars }
      : { stars: result.solo.stars, value: result.solo.value, lowerIsBetter: result.solo.lowerIsBetter });
    if (inLevel) store.recordLevel(player.profile.id, game.id, session.level, result.solo.stars);
    const earned = Math.max(1, result.solo.stars) + (saved.newRecord ? 1 : 0);
    store.addCoins(player.profile.id, earned);
    if (store.coins(player.profile.id) >= PACK_PRICE) packReady = true;
    headline = result.solo.stars >= 3 ? "Incroyable !" : result.solo.stars === 2 ? "Super !" : result.solo.stars === 1 ? "Bien joué !" : "Essaie encore !";
    if (inLevel && result.solo.stars) headline = `Niveau ${session.level + 1} réussi !`;
    if (inLevel && result.solo.stars && session.level + 1 < game.levels.length) nextLevel = session.level + 1;
    if (!result.solo.stars) mood = "triste";
    body = `<div class="solo-result" style="--seat:${player.color};--seat-soft:${player.soft}">
      <span class="solo-art">${player.art}</span>
      <div class="big-stars">${stars(result.solo.stars)}</div>
      <p class="solo-value">${result.solo.label}</p>
      ${inLevel ? "" : saved.newRecord ? `<p class="record">${icon("trophee")} Nouveau record !</p>` : saved.best !== null ? `<p class="best">Record : ${result.solo.format(saved.best)}</p>` : ""}
      ${result.solo.next ? `<p class="next-goal">${result.solo.next}</p>` : ""}
      ${coinsLine(earned)}
    </div>`;
    say(headline + " " + result.solo.speech);
  } else {
    const ranking = [...result.ranking].sort((a, b) => b.score - a.score);
    const top = ranking[0].score;
    const winners = ranking.filter(r => r.score === top);
    const earnedBy = {};
    ranking.forEach(r => {
      const seat = seats[r.seat];
      if (seat.kind !== "human") return;
      const win = winners.length === 1 && winners[0] === r;
      store.record(seat.profile.id, game.id, { win });
      earnedBy[r.seat] = win ? 3 : 1;
      store.addCoins(seat.profile.id, earnedBy[r.seat]);
      if (store.coins(seat.profile.id) >= PACK_PRICE) packReady = true;
    });
    // Place sur le podium : les égalités partagent la marche.
    let place = 0, previous = null;
    const placed = ranking.map((r, i) => { if (r.score !== previous) { place = i + 1; previous = r.score; } return { ...r, place }; });
    const order = placed.length >= 3 ? [placed[1], placed[0], placed[2], ...placed.slice(3)] : placed.length === 2 ? [placed[1], placed[0]] : placed;
    const winnerSeat = seats[winners[0].seat];
    headline = winners.length > 1 ? "Égalité !" : `${winnerSeat.label} gagne !`;
    body = `<div class="podium-steps">${order.map(r => {
      const seat = seats[r.seat];
      return `<div class="step place-${Math.min(r.place, 4)}" style="--seat:${seat.color};--seat-deep:${seat.deep};--seat-soft:${seat.soft}">
        <span class="step-art">${seat.art}</span>
        <span class="step-name">${seat.label}</span>
        ${earnedBy[r.seat] ? coinsLine(earnedBy[r.seat]) : ""}
        <span class="step-block"><b>${r.place}</b><small>${r.label ?? `${r.score} pt${r.score > 1 ? "s" : ""}`}</small></span>
      </div>`;
    }).join("")}</div>`;
    say(winners.length > 1 ? "Égalité ! Une revanche ?" : `Bravo ${winnerSeat.label} ! Tu gagnes !`);
  }

  const node = h(`<main class="screen podium">
    <div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i * 13) % 10};--c:${["#2F80ED", "#EB5757", "#27AE60", "#F2C94C", "#7B61FF"][i % 5]}"></i>`).join("")}</div>
    <header class="podium-top"><span class="podium-mascot">${mascotArt(mood)}</span><h2>${headline}</h2></header>
    ${body}
    <div class="podium-actions">
      ${nextLevel !== null
        ? `<button class="btn primary huge next-level">${icon("lecture")} Niveau ${nextLevel + 1}</button>
           <button class="btn wide replay">${icon("rejouer")} Rejouer le niveau ${session.level + 1}</button>`
        : `<button class="btn primary huge replay">${icon("rejouer")} Rejouer</button>`}
      ${packReady ? `<button class="btn pack-ready">${iconArt("piece")} Une pochette t'attend !</button>` : ""}
      <div class="row">
        ${session.level !== undefined
          ? `<button class="btn to-levels">${iconArt("etoile-pleine")} Niveaux</button>`
          : `<button class="btn players">${icon("personnes")} Joueurs</button>`}
        <button class="btn home-btn">${icon("accueil")} Autre jeu</button>
      </div>
    </div>
  </main>`);
  node.querySelector(".replay").addEventListener("click", () => app.go("play", { session }));
  node.querySelector(".players")?.addEventListener("click", () => app.go("who", { game, count: session.count }));
  node.querySelector(".to-levels")?.addEventListener("click", () => app.go("levels", { session }));
  node.querySelector(".next-level")?.addEventListener("click", () => app.go("rules", { session: { ...session, level: nextLevel } }));
  node.querySelector(".home-btn").addEventListener("click", () => app.go("home"));
  node.querySelector(".pack-ready")?.addEventListener("click", () => app.go("album", { profileId: seats.find(s => s.kind === "human" && store.coins(s.profile.id) >= PACK_PRICE)?.profile.id }));
  return { node, ready: () => play(solo && !result.solo.stars ? "pop" : "win") };
}
