// Album d'autocollants : la collection, les pochettes et leur tirage.
// Chaque partie rapporte des pièces ; une pochette coûte PACK_PRICE pièces et contient PACK_SIZE autocollants.
// Les doubles s'accumulent ; DOUBLES_PER_COIN doubles se revendent contre une pièce.
import { AVATARS, avatarArt, robotArt, mascotArt, hasImage, imagePath } from "./art.js";

export const PACK_PRICE = 10;
export const PACK_SIZE = 3;
export const DOUBLES_PER_COIN = 5;

const animals = Object.keys(AVATARS);
const MOODS = { salut: "La mascotte dit bonjour", explique: "La mascotte explique", bravo: "La mascotte fait la fête", triste: "La mascotte boude", surprise: "La mascotte surprise" };
const ROBOT_NAMES = { 1: "Robot dormeur", 2: "Robot attentif", 3: "Robot malin" };

// Autocollants faits d'une image : [fichier, nom affiché, rareté] ; « c » commun, « r » rare, « b » doré.
// Un autocollant n'entre dans l'album que si son image est livrée : l'album grandit avec chaque lot.
const RARITY = { c: "commun", r: "rare", b: "brillant" };

// Les héros et objets des jeux : images déjà livrées avec les jeux.
const HEROS = [
  ["course-grenouilles/grenouille-vert.png", "Grenouille sauteuse", "c"],
  ["course-grenouilles/escargot.png", "Escargot", "c"],
  ["course-grenouilles/herisson.png", "Hérisson", "c"],
  ["course-grenouilles/abeille.png", "Abeille", "c"],
  ["course-grenouilles/canard.png", "Canard en plastique", "c"],
  ["sumo-bulles/phoque.png", "Phoque", "c"],
  ["panier-fruits/guepe.png", "Guêpe", "c"],
  ["paires-cachees/coccinelle-5-points.png", "Coccinelle", "c"],
  ["paires-cachees/papillon-rose.png", "Papillon rose", "c"],
  ["paires-cachees/poisson-rayures.png", "Poisson rayé", "c"],
  ["paires-cachees/chien-tache.png", "Chien tacheté", "c"],
  ["paires-cachees/tortue-bleue.png", "Tortue bleue", "r"]
];
const JOUETS = [
  ["petits-bolides/voiture-rouge.png", "Petit bolide", "c"],
  ["orchestre/guitare.png", "Guitare", "c"],
  ["orchestre/violon.png", "Violon", "c"],
  ["orchestre/trompette.png", "Trompette", "c"],
  ["orchestre/tambour.png", "Tambour", "c"],
  ["orchestre/saxophone.png", "Saxophone", "r"],
  ["tour-bancale/grue.png", "Grue", "c"],
  ["les-canons/chateau-bleu.png", "Château", "c"],
  ["patate-chaude/bombe.png", "Patate chaude", "c"],
  ["calcul-eclair/eclair.png", "Éclair", "c"],
  ["tir-etoiles/etoile-doree.png", "Étoile dorée", "b"],
  ["panier-fruits/pomme-doree.png", "Pomme dorée", "b"]
];

// Lots 21 à 23 (docs/brief-album-lots-21-23.md) : images faites exprès pour l'album, dans assets/album/<famille>/.
const ALBUM = {
  dinos: [["t-rex", "T-rex", "c"], ["triceratops", "Tricératops", "c"], ["diplodocus", "Diplodocus", "c"], ["stegosaure", "Stégosaure", "c"],
    ["ankylosaure", "Ankylosaure", "c"], ["parasaurolophe", "Parasaurolophe", "c"], ["velociraptor", "Vélociraptor", "c"],
    ["pterodactyle", "Ptérodactyle", "r"], ["bebe-dino", "Bébé dino", "r"], ["oeuf-dino", "Œuf de dino doré", "b"]],
  mer: [["baleine", "Baleine", "c"], ["dauphin", "Dauphin", "c"], ["crabe", "Crabe", "c"], ["meduse", "Méduse", "c"],
    ["etoile-de-mer", "Étoile de mer", "c"], ["poisson-clown", "Poisson-clown", "c"], ["tortue-de-mer", "Tortue de mer", "c"],
    ["hippocampe", "Hippocampe", "r"], ["requin", "Requin gentil", "r"], ["coquillage-perle", "Coquillage à perle", "b"]],
  engins: [["camion-pompiers", "Camion de pompiers", "c"], ["tractopelle", "Tractopelle", "c"], ["tracteur", "Tracteur", "c"],
    ["train", "Train", "c"], ["bus", "Bus", "c"], ["avion", "Avion", "c"], ["voilier", "Voilier", "c"],
    ["helicoptere", "Hélicoptère", "r"], ["sous-marin", "Sous-marin", "r"], ["montgolfiere", "Montgolfière", "b"]],
  espace: [["astronaute", "Astronaute", "c"], ["planete-anneau", "Planète à anneau", "c"], ["soucoupe", "Soucoupe volante", "c"],
    ["extraterrestre", "Petit extraterrestre", "c"], ["satellite", "Satellite", "c"], ["rover", "Robot explorateur", "c"],
    ["telescope", "Télescope", "c"], ["comete", "Comète", "r"], ["station-spatiale", "Station spatiale", "r"], ["etoile-filante", "Étoile filante", "b"]],
  monstres: [["monstre-poilu", "Monstre poilu", "c"], ["monstre-cyclope", "Monstre à un œil", "c"], ["monstre-cornes", "Monstre à cornes", "c"],
    ["monstre-gelee", "Monstre en gelée", "c"], ["monstre-dents", "Monstre aux grandes dents", "c"], ["monstre-nuage", "Monstre nuage", "c"],
    ["monstre-tentacules", "Monstre à tentacules", "c"], ["monstre-ailes", "Monstre volant", "r"], ["yeti", "Petit yéti", "r"], ["monstre-roi", "Roi des monstres", "b"]],
  gourmandises: [["donut", "Donut", "c"], ["crepe", "Crêpe", "c"], ["cupcake", "Cupcake", "c"], ["sucette", "Sucette", "c"],
    ["croissant", "Croissant", "c"], ["pizza", "Pizza", "c"], ["macaron", "Macaron", "c"], ["coupe-glace", "Coupe de glace", "r"],
    ["bonbons", "Bonbons", "r"], ["gateau-anniversaire", "Gâteau d'anniversaire", "b"]]
};

const fromImages = (family, list) => list
  .filter(([path]) => hasImage(path))
  .map(([path, label, rarity]) => ({
    id: `${family}-${path.split("/").pop().replace(/\.png$/, "")}`, family, rarity: RARITY[rarity], label,
    art: () => `<img src="${imagePath(path)}" alt="" draggable="false">`
  }));

export const FAMILIES = [
  { id: "animaux", title: "Les animaux" },
  { id: "robots", title: "Les robots" },
  { id: "mascotte", title: "La mascotte" },
  { id: "heros", title: "Les héros des jeux" },
  { id: "jouets", title: "Les objets des jeux" },
  { id: "dinos", title: "Les dinosaures" },
  { id: "mer", title: "Sous la mer" },
  { id: "engins", title: "Les engins" },
  { id: "espace", title: "L'espace" },
  { id: "monstres", title: "Les monstres rigolos" },
  { id: "gourmandises", title: "Les gourmandises" },
  { id: "arc", title: "Arc-en-ciel" },
  { id: "or", title: "Dorés" }
];

export const STICKERS = [
  ...animals.map(a => ({ id: a, family: "animaux", rarity: "commun", label: AVATARS[a].label, art: () => avatarArt(a) })),
  ...[1, 2, 3].map(level => ({ id: `robot-${level}`, family: "robots", rarity: "commun", label: ROBOT_NAMES[level], art: () => robotArt(level) })),
  ...Object.keys(MOODS).map(mood => ({ id: `mascotte-${mood}`, family: "mascotte", rarity: mood === "bravo" || mood === "surprise" ? "rare" : "commun", label: MOODS[mood], art: () => mascotArt(mood) })),
  ...fromImages("heros", HEROS),
  ...fromImages("jouets", JOUETS),
  ...Object.entries(ALBUM).flatMap(([family, list]) => fromImages(family, list.map(([name, label, rarity]) => [`album/${family}/${name}.png`, label, rarity]))),
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

// Tire une pochette, au hasard : seule la rareté pèse (les dorés sont rares). Les doubles sont possibles.
export function drawPack() {
  const picks = [];
  for (let k = 0; k < PACK_SIZE; k++) {
    let roll = Math.random(), rarity = "commun";
    for (const [name, odds] of RARITY_ODDS) {
      if (roll < odds) { rarity = name; break; }
      roll -= odds;
    }
    const pool = STICKERS.filter(s => s.rarity === rarity);
    picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picks;
}
