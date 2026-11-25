// Dessins de l'application.
// Les images livrées (assets/…, listées dans images-list.js) remplacent automatiquement
// le dessin vectoriel de secours qui porte le même nom.
import "./images-list.js";

const IMAGES = new Set(globalThis.ASSET_IMAGES || []);
export const hasImage = path => IMAGES.has(path);
export const imagePath = path => `assets/${path}`;

const INK = "#2B2350";

function picture(path, fallback, label = "") {
  if (IMAGES.has(path)) return `<img src="assets/${path}" alt="${label}" draggable="false">`;
  return fallback;
}

/* ---------- Joueurs ---------- */

export const SEATS = [
  { name: "Bleu", color: "#2F80ED", deep: "#1C5DB8", soft: "#DCE9FC", shape: "rond" },
  { name: "Rouge", color: "#EB5757", deep: "#BE3434", soft: "#FCDEDE", shape: "triangle" },
  { name: "Vert", color: "#27AE60", deep: "#18804A", soft: "#D5F1E0", shape: "carre" },
  { name: "Jaune", color: "#F2C94C", deep: "#9A7000", soft: "#FCF1CC", shape: "etoile" }
];

export function shapePath(shape) {
  switch (shape) {
    case "triangle": return "M50 14 L88 82 H12 Z";
    case "carre": return "M18 18 H82 V82 H18 Z";
    case "etoile": return "M50 8 L61 37 L92 38 L68 57 L76 88 L50 70 L24 88 L32 57 L8 38 L39 37 Z";
    default: return "M50 14 A36 36 0 1 1 49.9 14 Z";
  }
}

export function shapeSVG(shape, color = "#fff") {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${shapePath(shape)}" fill="${color}" stroke-linejoin="round" stroke="${color}" stroke-width="6"/></svg>`;
}

/* ---------- Avatars ---------- */

export const AVATARS = {
  renard: { label: "Renard", fur: "#F08A3C" },
  lapin: { label: "Lapin", fur: "#ECE6F5" },
  ours: { label: "Ours", fur: "#A8714A" },
  chat: { label: "Chat", fur: "#A3ABC0" },
  grenouille: { label: "Grenouille", fur: "#7CC86B" },
  pingouin: { label: "Pingouin", fur: "#3A3F66" },
  panda: { label: "Panda", fur: "#FBFBFB" },
  hibou: { label: "Hibou", fur: "#9C7A5B" },
  dino: { label: "Dino", fur: "#8BC97A" },
  licorne: { label: "Licorne", fur: "#F6E8FF" },
  poulpe: { label: "Poulpe", fur: "#B9A6F2" },
  tortue: { label: "Tortue", fur: "#86C99A" }
};

const eyes = (y = 54, gap = 11, r = 4.6) =>
  `<circle cx="${50 - gap}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${50 + gap}" cy="${y}" r="${r}" fill="${INK}"/>
   <circle cx="${50 - gap + 1.6}" cy="${y - 1.8}" r="1.5" fill="#fff"/><circle cx="${50 + gap + 1.6}" cy="${y - 1.8}" r="1.5" fill="#fff"/>`;
const cheeks = `<ellipse cx="31" cy="66" rx="5" ry="3.2" fill="#FF9AA8" opacity=".7"/><ellipse cx="69" cy="66" rx="5" ry="3.2" fill="#FF9AA8" opacity=".7"/>`;
const smile = (y = 66) => `<path d="M44 ${y} Q50 ${y + 6} 56 ${y}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
const head = (fur, stroke = "#00000022") => `<circle cx="50" cy="57" r="31" fill="${fur}" stroke="${stroke}" stroke-width="2"/>`;

function avatarDrawing(id) {
  const a = AVATARS[id] || AVATARS.renard;
  const f = a.fur;
  let back = "", face = "";
  switch (id) {
    case "renard":
      back = `<path d="M24 44 L22 12 L46 32 Z M76 44 L78 12 L54 32 Z" fill="${f}"/><path d="M27 36 L26 20 L39 31 Z M73 36 L74 20 L61 31 Z" fill="#FFE3CC"/>`;
      face = `<path d="M22 60 Q36 58 50 76 Q64 58 78 60 Q72 86 50 88 Q28 86 22 60 Z" fill="#FFF3E6"/>${eyes()}<circle cx="50" cy="69" r="3.6" fill="${INK}"/>`;
      break;
    case "lapin":
      back = `<ellipse cx="38" cy="22" rx="8" ry="22" fill="${f}" stroke="#00000018" stroke-width="2"/><ellipse cx="62" cy="22" rx="8" ry="22" fill="${f}" stroke="#00000018" stroke-width="2"/>
              <ellipse cx="38" cy="23" rx="4" ry="15" fill="#FFB6C6"/><ellipse cx="62" cy="23" rx="4" ry="15" fill="#FFB6C6"/>`;
      face = `${eyes()}${cheeks}<path d="M46 63 Q50 67 54 63 Z" fill="#FF8FA6"/>${smile(68)}<rect x="46.5" y="69" width="7" height="6" rx="1.5" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`;
      break;
    case "ours":
      back = `<circle cx="26" cy="32" r="11" fill="${f}"/><circle cx="74" cy="32" r="11" fill="${f}"/><circle cx="26" cy="32" r="5.5" fill="#E6B48C"/><circle cx="74" cy="32" r="5.5" fill="#E6B48C"/>`;
      face = `<ellipse cx="50" cy="68" rx="14" ry="11" fill="#E6B48C"/>${eyes(52)}<ellipse cx="50" cy="64" rx="5" ry="3.6" fill="${INK}"/>${smile(70)}`;
      break;
    case "chat":
      back = `<path d="M23 46 L25 16 L46 32 Z M77 46 L75 16 L54 32 Z" fill="${f}"/><path d="M28 38 L29 24 L39 32 Z M72 38 L71 24 L61 32 Z" fill="#FFC2CF"/>`;
      face = `${eyes()}${cheeks}<path d="M47 63 L53 63 L50 66.5 Z" fill="#FF8FA6"/>${smile(68)}
              <path d="M20 62 H36 M21 69 L36 66 M80 62 H64 M79 69 L64 66" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
              <path d="M44 34 L50 40 L56 34" fill="none" stroke="#8790A8" stroke-width="3" stroke-linecap="round"/>`;
      break;
    case "grenouille":
      back = `<circle cx="33" cy="34" r="13" fill="${f}"/><circle cx="67" cy="34" r="13" fill="${f}"/>`;
      face = `<circle cx="33" cy="34" r="8" fill="#fff"/><circle cx="67" cy="34" r="8" fill="#fff"/><circle cx="34" cy="35" r="4.5" fill="${INK}"/><circle cx="68" cy="35" r="4.5" fill="${INK}"/>
              ${cheeks}<path d="M32 62 Q50 78 68 62" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
      break;
    case "pingouin":
      face = `<path d="M50 40 Q36 30 28 46 Q22 66 36 80 Q50 90 64 80 Q78 66 72 46 Q64 30 50 40 Z" fill="#fff"/>${eyes(55, 10)}${cheeks}
              <path d="M44 64 Q50 60 56 64 Q50 72 44 64 Z" fill="#FFA43A"/>`;
      break;
    case "panda":
      back = `<circle cx="26" cy="32" r="11" fill="${INK}"/><circle cx="74" cy="32" r="11" fill="${INK}"/>`;
      face = `<ellipse cx="38" cy="55" rx="9" ry="11" transform="rotate(-25 38 55)" fill="${INK}"/><ellipse cx="62" cy="55" rx="9" ry="11" transform="rotate(25 62 55)" fill="${INK}"/>
              <circle cx="39" cy="54" r="3.6" fill="#fff"/><circle cx="61" cy="54" r="3.6" fill="#fff"/><ellipse cx="50" cy="66" rx="4.5" ry="3.2" fill="${INK}"/>${smile(70)}`;
      break;
    case "hibou":
      back = `<path d="M24 38 L22 16 L40 30 Z M76 38 L78 16 L60 30 Z" fill="${f}"/>`;
      face = `<path d="M50 80 Q30 82 26 64 Q50 70 74 64 Q70 82 50 80 Z" fill="#E8D2B4"/>
              <circle cx="37" cy="51" r="12" fill="#FFF6E0"/><circle cx="63" cy="51" r="12" fill="#FFF6E0"/>
              <circle cx="37" cy="52" r="6" fill="${INK}"/><circle cx="63" cy="52" r="6" fill="${INK}"/><circle cx="39" cy="50" r="2" fill="#fff"/><circle cx="65" cy="50" r="2" fill="#fff"/>
              <path d="M46 61 L54 61 L50 69 Z" fill="#F5A623"/>`;
      break;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${back}${head(f)}${face}</svg>`;
}

export function avatarArt(id) {
  return picture(`commun/avatars/avatar-${id}.png`, avatarDrawing(id), AVATARS[id]?.label || "");
}

/* ---------- Robots ---------- */

export const ROBOTS = {
  1: { label: "Robot facile", short: "Facile" },
  2: { label: "Robot moyen", short: "Moyen" },
  3: { label: "Robot fort", short: "Fort" }
};
const ROBOT_FILES = { 1: "facile", 2: "moyen", 3: "fort" };

function robotDrawing(level) {
  const body = ["#B9C4E8", "#9AA8DE", "#8B7BE0"][level - 1];
  const eyesX = level === 1 ? [50] : level === 2 ? [38, 62] : [32, 50, 68];
  const eyeSvg = eyesX.map(x => level === 1
    ? `<path d="M${x - 8} 54 Q${x} 59 ${x + 8} 54" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="53" r="7" fill="#fff"/><circle cx="${x + (level === 3 ? 1.5 : 0)}" cy="54" r="3.8" fill="${INK}"/>`).join("");
  const mouth = level === 3
    ? `<path d="M38 70 Q50 76 62 68" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
    : `<rect x="40" y="67" width="20" height="6" rx="3" fill="${INK}" opacity=".75"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <line x1="50" y1="26" x2="50" y2="12" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="11" r="5" fill="#FFD25A"/>
    <rect x="12" y="46" width="8" height="18" rx="3" fill="${body}"/><rect x="80" y="46" width="8" height="18" rx="3" fill="${body}"/>
    <rect x="18" y="26" width="64" height="58" rx="18" fill="${body}" stroke="#00000022" stroke-width="2"/>
    <rect x="25" y="40" width="50" height="26" rx="12" fill="#2B2350" opacity=".12"/>
    ${eyeSvg}${mouth}
    ${level === 1 ? `<text x="72" y="30" font-size="13" font-family="Fredoka, sans-serif" font-weight="700" fill="${INK}" opacity=".6">z</text>` : ""}
  </svg>`;
}

export function robotArt(level) {
  return picture(`commun/robots/robot-${ROBOT_FILES[level]}.png`, robotDrawing(level), ROBOTS[level].label);
}

/* ---------- Mascotte ---------- */

export function mascotArt(mood = "salut") {
  const arms = {
    salut: `<path d="M22 62 Q8 50 12 34" /><path d="M78 62 Q90 66 92 76" />`,
    bravo: `<path d="M22 60 Q10 42 16 26" /><path d="M78 60 Q90 42 84 26" />`,
    explique: `<path d="M22 64 Q12 70 14 80" /><path d="M78 60 Q92 54 96 44" />`
  }[mood] || "";
  const mouth = mood === "bravo"
    ? `<path d="M40 64 Q50 76 60 64 Z" fill="${INK}"/>`
    : `<path d="M42 64 Q50 71 58 64" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const drawing = `<svg viewBox="0 0 100 110" aria-hidden="true">
    <g fill="none" stroke="#5A43D6" stroke-width="7" stroke-linecap="round">${arms}<path d="M38 92 V104" /><path d="M62 92 V104" /></g>
    <rect x="20" y="38" width="60" height="56" rx="12" fill="#7B61FF"/>
    <rect x="20" y="38" width="60" height="12" rx="6" fill="#6A4FF0"/>
    <path d="M16 34 Q50 16 84 34 L80 42 H20 Z" fill="#9B86FF"/>
    <circle cx="30" cy="22" r="6" fill="#F2C94C"/><path d="M58 16 l4 -8 l4 8 z" fill="#EB5757"/><rect x="42" y="12" width="9" height="9" rx="2" fill="#27AE60"/>
    <circle cx="39" cy="57" r="5.5" fill="#fff"/><circle cx="61" cy="57" r="5.5" fill="#fff"/>
    <circle cx="40" cy="58" r="3" fill="${INK}"/><circle cx="62" cy="58" r="3" fill="${INK}"/>
    <ellipse cx="31" cy="67" rx="4.5" ry="3" fill="#FF9AA8" opacity=".8"/><ellipse cx="69" cy="67" rx="4.5" ry="3" fill="#FF9AA8" opacity=".8"/>
    ${mouth}
  </svg>`;
  return picture(`commun/mascotte-${mood}.png`, drawing, "La mascotte");
}

/* ---------- Icônes ---------- */

const ICONS = {
  retour: `<path d="M15 6 L8 12 L15 18"/>`,
  accueil: `<path d="M4 11 L12 4 L20 11"/><path d="M6.5 9.5 V19 H17.5 V9.5"/>`,
  rejouer: `<path d="M19 12 A7 7 0 1 1 16.5 6.6"/><path d="M17.5 2.8 V7.2 H13"/>`,
  pause: `<path d="M9 6 V18 M15 6 V18"/>`,
  lecture: `<path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/>`,
  "son-on": `<path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor"/><path d="M16.5 8.5 Q19 12 16.5 15.5"/><path d="M19 6 Q23 12 19 18"/>`,
  "son-off": `<path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor"/><path d="M17 9 L22 15 M22 9 L17 15"/>`,
  plus: `<path d="M12 5 V19 M5 12 H19"/>`,
  croix: `<path d="M6 6 L18 18 M18 6 L6 18"/>`,
  poubelle: `<path d="M4.5 7 H19.5"/><path d="M9.5 7 V4.5 H14.5 V7"/><path d="M6.5 7 L7.5 20 H16.5 L17.5 7"/><path d="M10.5 11 V16 M13.5 11 V16"/>`,
  reglages: `<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5 M5.3 5.3 L7.4 7.4 M16.6 16.6 L18.7 18.7 M5.3 18.7 L7.4 16.6 M16.6 7.4 L18.7 5.3"/>`,
  personnes: `<circle cx="9" cy="8" r="3.2"/><path d="M3 19 Q3 13 9 13 Q15 13 15 19"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 13.4 Q21 13 21 18.5"/>`,
  eclair: `<path d="M13 2 L5 13.5 H11 L10 22 L19 10 H13 Z" fill="currentColor"/>`,
  trophee: `<path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" fill="currentColor"/><path d="M7 6 H3.5 Q3.5 11 7.5 11 M17 6 H20.5 Q20.5 11 16.5 11"/><path d="M12 14 V18 M8 20 H16"/>`
};

// Icône dessinée en image (violette) : seulement sur fond clair. Sinon l'icône vectorielle.
export function iconArt(name) {
  return picture(`commun/icones/${name}.png`, icon(name), "");
}

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

export function starSVG(filled) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${shapePath("etoile")}" fill="${filled ? "#FFC83D" : "#E9DFCB"}" stroke="${filled ? "#E59A00" : "#D5C8AE"}" stroke-width="5" stroke-linejoin="round"/></svg>`;
}

export function peopleArt(count, color = INK) {
  return picture(`commun/icones/${count === 1 ? "joueur-1" : "joueurs-" + count}.png`, peopleSVG(count, color), "");
}

export function peopleSVG(count, color = INK) {
  const xs = { 1: [50], 2: [34, 66], 3: [22, 50, 78], 4: [14, 38, 62, 86] }[count];
  const r = count > 2 ? 9 : 12;
  return `<svg viewBox="0 0 100 70" aria-hidden="true">${xs.map(x =>
    `<circle cx="${x}" cy="${count > 2 ? 26 : 22}" r="${r}" fill="${color}"/><path d="M${x - r * 1.5} 64 Q${x - r * 1.5} ${count > 2 ? 40 : 38} ${x} ${count > 2 ? 40 : 38} Q${x + r * 1.5} ${count > 2 ? 40 : 38} ${x + r * 1.5} 64 Z" fill="${color}"/>`).join("")}</svg>`;
}
