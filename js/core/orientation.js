// Orientation de l'écran pendant une partie.
//
// Un jeu peut demander le paysage (orientation: "landscape"). Deux moyens, du plus propre au plus sûr :
// 1. Verrouiller l'orientation (application installée sur Android) : le téléphone ne tourne plus.
// 2. Sinon (iPhone, rotation automatique coupée…) : si l'écran est en portrait, on affiche le jeu
//    tourné d'un quart de tour. Il suffit de tenir le téléphone en largeur, sans rien régler.
// Les autres jeux gardent l'orientation du moment, verrouillée si possible : le jeu ne bascule pas
// quand on pose le téléphone à plat ou qu'on se le passe.

const touchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export function enterGameOrientation(wanted) {
  document.body.classList.toggle("want-landscape", wanted === "landscape");
  const current = screen.orientation?.type?.startsWith("portrait") ? "portrait" : "landscape";
  const target = wanted || current;
  const lock = () => screen.orientation?.lock?.(target).catch(() => {});
  // Pas de plein écran demandé : Chrome afficherait à chaque partie un message qui cache le jeu
  // (« balayez pour quitter le plein écran »). L'application installée est déjà en plein écran,
  // et si le verrouillage échoue, le jeu en largeur s'affiche tourné (voir plus haut).
  if (touchDevice()) lock();
  return function leaveGameOrientation() {
    document.body.classList.remove("want-landscape");
    try { screen.orientation?.unlock?.(); } catch { /* non pris en charge */ }
  };
}

// Vrai quand le jeu est affiché tourné d'un quart de tour (paysage demandé, écran en portrait).
export function isTurned() {
  return document.body.classList.contains("want-landscape") && window.innerHeight > window.innerWidth;
}
