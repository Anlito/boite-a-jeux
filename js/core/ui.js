// Petits outils d'interface partagés par les écrans.
import { icon, SEATS, avatarArt, robotArt, AVATARS, ROBOTS } from "./art.js";
import { store } from "./store.js";
import { play } from "./sound.js";

export function h(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function on(root, selector, type, handler) {
  root.querySelectorAll(selector).forEach(node => node.addEventListener(type, event => handler(event, node)));
}

export function iconButton(name, label, extra = "") {
  return `<button class="icon-btn ${extra}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
}

export function modal(content, { onClose } = {}) {
  const layer = h(`<div class="modal-layer"><div class="modal" role="dialog" aria-modal="true"></div></div>`);
  const box = layer.firstElementChild;
  if (typeof content === "string") box.innerHTML = content;
  else box.append(content);
  const close = () => {
    layer.classList.add("closing");
    setTimeout(() => layer.remove(), 160);
    onClose?.();
  };
  layer.addEventListener("pointerdown", event => { if (event.target === layer) close(); });
  document.body.append(layer);
  return { box, close };
}

// Ce que l'on montre d'une place : couleur, nom, dessin.
export function describeSeat(seat, index) {
  const colors = SEATS[index];
  if (seat?.kind === "robot") {
    return { ...colors, seatName: colors.name, kind: "robot", level: seat.level, label: ROBOTS[seat.level].label, art: robotArt(seat.level), boost: 0 };
  }
  const profile = seat?.kind === "human" ? store.profile(seat.profileId) : null;
  if (!profile) return { ...colors, seatName: colors.name, kind: "empty", label: colors.name, art: "", boost: 0 };
  return { ...colors, seatName: colors.name, kind: "human", profile, label: profile.name || AVATARS[profile.avatar]?.label, art: avatarArt(profile.avatar), boost: seat.boost || 0 };
}

// Rebond + son sur chaque bouton : l'enfant sait que son appui a compté.
document.addEventListener("pointerdown", event => {
  const target = event.target.closest("button:not(:disabled), .tap");
  if (!target || target.closest(".play")) return;
  play("tap");
}, true);
