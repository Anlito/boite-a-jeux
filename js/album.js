// Écran « Mon album » : la collection d'autocollants de chaque enfant et l'ouverture des pochettes.
import { store } from "./core/store.js";
import { play, say } from "./core/sound.js";
import { h, on, modal, iconButton } from "./core/ui.js";
import { avatarArt, mascotArt, iconArt, icon } from "./core/art.js";
import { STICKERS, FAMILIES, PACK_PRICE, DOUBLES_PER_COIN, stickerById, stickerHTML, drawPack } from "./core/stickers.js";

let lastProfile = null;

export function album(app, { profileId } = {}) {
  const profiles = store.profiles;
  const node = h(`<main class="screen album">
    <header class="bar">${iconButton("retour", "Retour à l'accueil", "back")}<h2>Mon album</h2><span class="bar-space"></span></header>
    <div class="album-body"></div>
  </main>`);
  node.querySelector(".back").addEventListener("click", () => app.go("home"));
  const body = node.querySelector(".album-body");

  if (!profiles.length) {
    body.innerHTML = `<div class="album-empty"><span class="album-empty-mascot">${mascotArt("explique")}</span>
      <p class="bubble">Joue à un jeu pour créer ton joueur et gagner tes premières pièces !</p></div>`;
    return { node, ready: () => say("Joue à un jeu pour gagner tes premières pièces !") };
  }

  let current = profiles.find(p => p.id === profileId) || profiles.find(p => p.id === lastProfile) || profiles[0];

  function render() {
    lastProfile = current.id;
    const owned = store.stickers(current.id);
    const coins = store.coins(current.id);
    const found = STICKERS.filter(s => owned[s.id]).length;
    const canOpen = coins >= PACK_PRICE;
    const doubles = store.doubles(current.id);
    const canSell = doubles >= DOUBLES_PER_COIN;
    body.innerHTML = `
      <nav class="album-people" aria-label="Choisir l'album">${profiles.map(p => `
        <button class="album-person ${p.id === current.id ? "current" : ""}" data-profile="${p.id}" aria-label="Album de ${p.name}">
          <span class="album-person-art">${avatarArt(p.avatar)}</span><span>${p.name}</span>
          ${(p.coins || 0) >= PACK_PRICE ? `<i class="dot" aria-hidden="true"></i>` : ""}
        </button>`).join("")}
      </nav>
      <section class="album-top">
        <div class="album-coins">${iconArt("piece")}<b>${coins}</b></div>
        <div class="album-progress" aria-label="${found} autocollants trouvés sur ${STICKERS.length}">
          <span class="album-bar"><i style="width:${Math.round(found / STICKERS.length * 100)}%"></i></span>
          <span>${found} / ${STICKERS.length}</span>
        </div>
        <button class="btn primary open-pack" ${canOpen ? "" : "disabled"}>
          <span class="mini-pack" aria-hidden="true"></span> Ouvrir une pochette
          <span class="price">${PACK_PRICE} ${iconArt("piece")}</span>
        </button>
        ${canOpen ? "" : `<p class="album-hint">Encore ${PACK_PRICE - coins} pièce${PACK_PRICE - coins > 1 ? "s" : ""} : joue pour les gagner !</p>`}
        <div class="album-doubles">
          <span class="doubles-pile" aria-label="${doubles} double${doubles > 1 ? "s" : ""}">${Array.from({ length: DOUBLES_PER_COIN }, (_, k) => `<i class="${k < doubles ? "on" : ""}"></i>`).join("")}</span>
          <span class="doubles-text">${doubles} double${doubles > 1 ? "s" : ""}</span>
          <button class="btn sell-doubles" ${canSell ? "" : "disabled"}>${DOUBLES_PER_COIN} doubles → 1 ${iconArt("piece")}</button>
        </div>
      </section>
      ${FAMILIES.map(family => `
        <section class="album-family">
          <h3>${family.title}</h3>
          <div class="sticker-grid">${STICKERS.filter(s => s.family === family.id).map(s => stickerHTML(s, owned[s.id] || 0)).join("")}</div>
        </section>`).join("")}`;
    on(body, "[data-profile]", "click", (_, button) => {
      current = profiles.find(p => p.id === button.dataset.profile);
      render();
    });
    body.querySelector(".open-pack").addEventListener("click", openPack);
    body.querySelector(".sell-doubles").addEventListener("click", () => {
      if (!store.sellDoubles(current.id, DOUBLES_PER_COIN, id => stickerById(id)?.rarity)) return;
      play("point");
      say("Et voilà, une pièce !");
      render();
    });
  }

  function openPack() {
    const picks = drawPack();
    const result = store.openPack(current.id, PACK_PRICE, picks.map(s => s.id));
    if (!result) return;
    const content = h(`<div class="pack-open">
      <button class="pack" aria-label="Ouvrir la pochette">
        <span class="pack-shine"></span><span class="pack-mascot">${mascotArt("surprise")}</span><span class="pack-q">?</span>
      </button>
      <div class="pack-cards">${result.map(({ id, isNew }, k) => `
        <div class="pack-card" style="--k:${k}">
          ${stickerHTML(stickerById(id))}
          <span class="pack-tag ${isNew ? "new" : ""}">${isNew ? "Nouveau !" : "Double"}</span>
        </div>`).join("")}</div>
      <p class="pack-hint">Touche la pochette !</p>
      <button class="btn primary wide pack-done" hidden>${icon("lecture")} Super !</button>
    </div>`);
    const dialog = modal(content, { onClose: render });
    const pack = content.querySelector(".pack");
    say("Touche la pochette pour l'ouvrir !");
    pack.addEventListener("click", () => {
      if (content.classList.contains("opened")) return;
      content.classList.add("opened");
      play("pop");
      const best = result.map(r => stickerById(r.id)).find(s => s.rarity === "brillant") || result.map(r => stickerById(r.id)).find(s => s.rarity === "rare");
      result.forEach((r, k) => setTimeout(() => play(stickerById(r.id).rarity === "commun" ? "point" : "star"), 450 + k * 380));
      setTimeout(() => {
        content.querySelector(".pack-done").hidden = false;
        const fresh = result.filter(r => r.isNew).length;
        if (best?.rarity === "brillant") { play("win"); say("Waouh, un autocollant doré !"); }
        else if (best?.rarity === "rare") say("Un autocollant rare !");
        else say(fresh ? `${fresh} nouveau${fresh > 1 ? "x" : ""} pour ton album !` : "Des doubles ! Garde-les : cinq doubles valent une pièce.");
      }, 450 + result.length * 380);
    });
    content.querySelector(".pack-done").addEventListener("click", dialog.close);
  }

  render();
  return { node, ready: () => say(store.coins(current.id) >= PACK_PRICE ? "Tu peux ouvrir une pochette !" : "Voici ton album !") };
}
