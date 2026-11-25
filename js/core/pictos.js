// Les 48 petits dessins du lot 13, partagés par Œil de lynx et Paires cachées.
// Chaque dessin a un nom (celui de son image dans assets/pictos/) ; sans l'image, on montre l'émoji.
import { hasImage, imagePath } from "./art.js";

const EMOJI = {
  chien: "🐶", chat: "🐱", lapin: "🐰", renard: "🦊", ours: "🐻", panda: "🐼", koala: "🐨", tigre: "🐯",
  lion: "🦁", vache: "🐮", cochon: "🐷", grenouille: "🐸", singe: "🐵", poule: "🐔", pingouin: "🐧", hibou: "🦉",
  pomme: "🍎", poire: "🍐", orange: "🍊", citron: "🍋", banane: "🍌", pasteque: "🍉", raisin: "🍇", fraise: "🍓",
  cerises: "🍒", peche: "🍑", kiwi: "🥝", ananas: "🍍", "noix-de-coco": "🥥", myrtilles: "🫐", carotte: "🥕", champignon: "🍄",
  voiture: "🚗", fusee: "🚀", "ballon-foot": "⚽", "ballon-baudruche": "🎈", "arc-en-ciel": "🌈", etoile: "⭐", tournesol: "🌻", glace: "🍦",
  cadeau: "🎁", guitare: "🎸", reveil: "⏰", cle: "🔑", soleil: "☀️", lune: "🌙", flocon: "❄️", puzzle: "🧩"
};

const names = Object.keys(EMOJI);
export const PICTOS = {
  animaux: names.slice(0, 16),
  fruits: names.slice(16, 32),
  objets: names.slice(32, 48),
  tous: names
};

export const pictoHTML = name => hasImage(`pictos/${name}.png`)
  ? `<img class="picto" src="${imagePath(`pictos/${name}.png`)}" alt="" draggable="false">`
  : EMOJI[name] || name;
