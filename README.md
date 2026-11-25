# La boîte à jeux

Mini-jeux pour enfants, à jouer seul, contre un robot ou jusqu'à 4 sur le même téléphone ou la même tablette.
Application web installable, sans compte, sans publicité, qui fonctionne hors ligne.

## Jeux

| Jeu | Joueurs | État |
| --- | --- | --- |
| Top départ | 1 à 4, robots | Jouable |
| Sumo-bulles | 1 à 4, robots | Jouable |
| Les canons | 1 à 4, robots, chacun son tour | Jouable |
| Astro-balles | 1 à 4 (une raquette par côté), robots | Jouable |
| Course des grenouilles | 1 à 4 couloirs, robots | Jouable |
| Panier de fruits | 1 à 4 vergers, robots | Jouable |
| Tir aux étoiles | 1 à 4, robots, chacun son tour | Jouable |
| Serpentins | 1 à 4, robots (deux boutons : gauche, droite) | Jouable |
| Patate chaude | 1 à 4, robots (mini-défis pour renvoyer la bombe) | Jouable |
| Calcul-éclair | 1 à 4, robots (niveau choisi par chacun, du « petit » au CE2 : additions, soustractions, tables de 2 et 3) | Jouable |
| Œil de lynx | 1 à 4, robots (trouver le dessin commun entre deux cartes) | Jouable |
| Paires cachées | 1 à 4, robots, chacun son tour (jeu de mémoire) | Jouable |
| Petits bolides | 1 à 4, robots (course sur 10 circuits, joystick) | Jouable |
| Palet glissant | 1 à 2, robot (hockey sur table, face à face) | Jouable |
| Quatre à la suite | 1 à 2, robot, chacun son tour (aligner 4 jetons) | Jouable |
| La tour bancale | 1 à 4, robots, chacun son tour (empiler des étages) | Jouable |
| L’orchestre | 1 à 4, robots, chacun son tour (mémoire des sons) | Jouable |

En solo, chaque jeu a 10 niveaux dessinés à la main (une étoile débloque le suivant) puis un défi libre, ouvert après le niveau 5.

## Organisation

- `index.html`, `css/app.css` : la page et la charte graphique.
- `js/main.js` : navigation entre les écrans.
- `js/screens.js` : écrans communs (accueil, nombre de joueurs, qui joue, règles, partie, podium).
- `js/album.js` et `js/core/stickers.js` : pièces et album d'autocollants (88 autocollants en 3 raretés — lot 21 : dinosaures et mer —, et jusqu'à 128 quand les lots 22 et 23 seront livrés — un autocollant n'apparaît que si son image existe ; pochette à 10 pièces tirée au hasard, 5 doubles se vendent contre 1 pièce).
- `js/core/` : socle partagé — dessins (`art.js`), sons et voix (`sound.js`), profils et records (`store.js`), outils d'interface (`ui.js`), moteur des jeux dessinés (`stage.js` : terrain aux proportions fixes, boucle, particules).
- `js/games/` : un fichier par jeu, déclaré dans `js/games/index.js`.
- `sw.js` : fonctionnement hors ligne. Changer `VERSION` à chaque mise en ligne.

## Ajouter un jeu

Un jeu est un module qui exporte :

```js
export default {
  id, title,
  players: { min, max },   // de 1 à 4
  robots: true,            // des robots peuvent remplir les places
  orientation: "landscape", // facultatif : paysage imposé (sinon l'orientation du moment, verrouillée)
  levels: [{ goal, … }],    // facultatif : niveaux solo (ctx.level reçoit le niveau, null en défi libre)
  theme: { bg, ink },      // couleurs de sa vignette
  vignette: () => "<svg…>",
  rules: { text: session => "…", demo: session => ({ node, stop }) },
  mount(root, ctx)         // ctx.seats, ctx.count, ctx.finish(result)
                           // renvoie { start, pause, resume, destroy }
};
```

`ctx.finish` reçoit soit `{ ranking: [{ seat, score, label? }] }` (à plusieurs), soit `{ solo: { stars, value, lowerIsBetter, label, speech, format, next } }`.

## Visuels

Les images viennent du brief donné à ChatGPT (voir le cahier des charges). Lots 1 à 20 intégrés (lot 20 : crosses bleue et rouge — avatar sur la poignée —, palet et plot de Palet glissant, jetons bleu et rouge de Quatre à la suite ; une autre couleur de joueur garde le dessin ; lot 19 : 6 instruments de L’orchestre à la place des emojis — sur des boutons clairs cerclés de la couleur de l’instrument, qui se teintent quand il joue, sinon le piano rouge disparaîtrait sur un bouton rouge —, note qui s’envole de l’instrument qui joue, et scène de théâtre en fond ; lot 18 : étages aux 6 couleurs de La tour bancale — découpés en bords et tranches à fenêtre, pour que les fenêtres gardent leur forme quelle que soit la largeur de l’étage ; à plusieurs, l’étage prend l’image la plus proche de la couleur du joueur —, socle, toit, grue en treillis qui se répète, chariot à crochet, nuages, ville posée sur le sol, puis soir et espace qui se répète en montant ; lot 17 : vignettes de Palet glissant et de Quatre à la suite ; lot 16 : vignettes d’Œil de lynx et de Paires cachées ; lot 15 : herbe en carreau qui se répète, voitures aux 4 couleurs avec l’avatar dans le cockpit, taches d’huile, flèches turbo, drapeau à damier, poussière dans l’herbe, et arbres, buissons, pneus et tribune posés au hasard hors de la route de Petits bolides — la route reste dessinée par le jeu, car le circuit change ; lot 14 : dos, face et carte trouvée de Paires cachées — recadrés sur la carte visible —, tapis rose, et 8 couples d’animaux presque pareils pour le thème « pareils », tirés par couples entiers ; lot 13 : 48 pictos — 16 animaux, 16 fruits et légumes, 16 objets — partagés par Œil de lynx et Paires cachées via `js/core/pictos.js`, qui retombe sur les émojis sans les images ; le niveau « qui se ressemblent » de Paires cachées utilise les têtes d’animaux ; lot 12 : ardoise de Calcul-éclair — recadrée sur le tableau, mur rendu transparent, étirée en 9 morceaux pour garder coins et craies —, étoile « Bravo », nuage « raté », éclair du plus rapide, flamme des séries et chronomètre ; lot 11 : bombe calme et paniquée — mèche retirée des images, le jeu la dessine pour qu’elle brûle —, explosion, ballons, ballon éclaté, tambour et cœurs de Patate chaude ; lot 10 : portails, pomme et anneau d’étincelles de Serpentins ; le tapis n’est pas utilisé tel quel, car le terrain prend la forme de l’écran : ses couleurs sont reprises dans le dessin ; lot 9 : plateau encadré de bois, billes aux 4 couleurs, étoiles, étoile d’or, champignon et lance-pierre de Tir aux étoiles ; lot 8 : ciel, raquettes-vaisseaux, balle-comète, balle rouge, bonus, cœurs et étincelles d’Astro-balles ; lot 7 : décor de mare qui défile, grenouilles aux 4 couleurs assises et en saut, obstacles, pièces et drapeau de la Course des grenouilles ; lot 6 : verger, paniers aux 4 couleurs, fruits, pièges et bonus de Panier de fruits ; lot 3 : Top départ ; lot 5 : ciel, châteaux intacts et abîmés, canon, boulet, explosion et drapeau du vent des Canons — le fond « colline » n’est pas utilisé, car le terrain change à chaque partie et se creuse sous les tirs ; lot 4 : océan, banquise, phoque, bouclier et éclaboussure de Sumo-bulles — les bulles à animal imposé ne sont pas utilisées, le jeu montre l’avatar choisi) : mascotte, 12 avatars, 3 robots, icônes, décors, effets ; 18 vignettes de jeux (JPG 640 × 480).

Pour ajouter un lot : réduire les images à la taille affichée (personnages 512 px, icônes 128 px, effets 256 px, décors en JPG 1600 px), les placer dans `assets/` avec les noms du brief, puis les ajouter à `js/core/images-list.js`. Elles remplacent alors le dessin vectoriel de même nom et sont gardées pour le hors-ligne. Les icônes livrées sont violettes : elles ne servent que sur fond clair, les boutons colorés gardent les icônes vectorielles blanches.

## Tester en local

Servir le dossier avec n'importe quel serveur statique (les modules JavaScript ne marchent pas en ouvrant le fichier directement), par exemple `npx serve`.
