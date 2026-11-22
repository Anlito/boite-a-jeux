// Album d'autocollants : la collection, les pochettes et leur tirage.
// Chaque partie rapporte des pièces ; une pochette coûte PACK_PRICE pièces et contient PACK_SIZE autocollants.
import { AVATARS, avatarArt, robotArt, mascotArt } from "./art.js";

export const PACK_PRICE = 5;
export const PACK_SIZE = 3;

const animals = Object.keys(AVATARS);
const MOODS = { salut: "La mascotte dit bonjour", explique: "La mascotte explique", bravo: "La mascotte fait la fête", triste: "La mascotte boude", surprise: "La mascotte surprise" };
const ROBOT_NAMES = { 1: "Robot dormeur", 2: "Robot attentif", 3: "Robot malin" };

export const FAMILIES = [
  { id: "animaux", title: "Les animaux" },
  { id: "robots", title: "Les robots" },
  { id: "mascotte", title: "La mascotte" },
  { id: "arc", title: "Arc-en-ciel" },
  { id: "or", title: "Dorés" }
];

export const STICKERS = [
  ...animals.map(a => ({ id: a, family: "animaux", rarity: "commun", label: AVATARS[a].label, art: () => avatarArt(a) })),
  ...[1, 2, 3].map(level => ({ id: `robot-${level}`, family: "robots", rarity: "commun", label: ROBOT_NAMES[level], art: () => robotArt(level) })),
  ...Object.keys(MOODS).map(mood => ({ id: `mascotte-${mood}`, family: "mascotte", rarity: mood === "bravo" || mood === "surprise" ? "rare" : "commun", label: MOODS[mood], art: () => mascotArt(mood) })),
  ...animals.map(a => ({ id: `${a}-arc`, family: "arc", rarity: "rare", label: `${AVATARS[a].label} arc-en-ciel`, art: () => avatarArt(a) })),
  ...animals.map(a => ({ id: `${a}-or`, family: "or", rarity: "brillant", label: `${AVATARS[a].label} doré`, art: () => avatarArt(a) }))
];

export const stickerById = id => STICKERS.find(s => s.id === id);

// Un autocollant à l'écran. owned = 0 : silhouette mystère.
export function stickerHTML(sticker, owned = 1) {
  const extra = owned > 1 ? `<span class="sticker-count">×${owned}</span>` : "";
  return `<span class="sticker ${sticker.rarity} ${owned ? "" : "missing"}" title="${owned ? sticker.label : "Pas encore trouvé"}">
    <span class="sticker-art">${sticker.art()}</span>${owned ? "" : `<span class="sticker-mystery">?</span>`}${extra}
  </span>`;
}

const RARITY_ODDS = [["brillant", 0.08], ["rare", 0.22], ["commun", 0.70]];

// Tire une pochette. Les autocollants pas encore trouvés sortent plus souvent, pour que l'album avance.
export function drawPack(owned) {
  const picks = [];
  for (let k = 0; k < PACK_SIZE; k++) {
    let roll = Math.random(), rarity = "commun";
    for (const [name, odds] of RARITY_ODDS) {
      if (roll < odds) { rarity = name; break; }
      roll -= odds;
    }
    const pool = STICKERS.filter(s => s.rarity === rarity);
    const missing = pool.filter(s => !owned[s.id] && !picks.includes(s));
    const from = missing.length && Math.random() < 0.65 ? missing : pool;
    picks.push(from[Math.floor(Math.random() * from.length)]);
  }
  return picks;
}
