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

En solo, chaque jeu a 10 niveaux dessinés à la main (une étoile débloque le suivant) puis un défi libre, ouvert après le niveau 5.

## Organisation

- `index.html`, `css/app.css` : la page et la charte graphique.
- `js/main.js` : navigation entre les écrans.
- `js/screens.js` : écrans communs (accueil, nombre de joueurs, qui joue, règles, partie, podium).
- `js/album.js` et `js/core/stickers.js` : pièces et album d'autocollants (44 autocollants en 3 raretés, pochette à 5 pièces tirée au hasard, 5 doubles se vendent contre 1 pièce).
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

Les images viennent du brief donné à ChatGPT (voir le cahier des charges). Lots 1 à 5 intégrés (lot 3 : Top départ ; lot 5 : ciel, châteaux intacts et abîmés, canon, boulet, explosion et drapeau du vent des Canons — le fond « colline » n’est pas utilisé, car le terrain change à chaque partie et se creuse sous les tirs ; lot 4 : océan, banquise, phoque, bouclier et éclaboussure de Sumo-bulles — les bulles à animal imposé ne sont pas utilisées, le jeu montre l’avatar choisi) : mascotte, 12 avatars, 3 robots, icônes, décors, effets ; 14 vignettes de jeux (JPG 640 × 480).

Pour ajouter un lot : réduire les images à la taille affichée (personnages 512 px, icônes 128 px, effets 256 px, décors en JPG 1600 px), les placer dans `assets/` avec les noms du brief, puis les ajouter à `js/core/images-list.js`. Elles remplacent alors le dessin vectoriel de même nom et sont gardées pour le hors-ligne. Les icônes livrées sont violettes : elles ne servent que sur fond clair, les boutons colorés gardent les icônes vectorielles blanches.

## Tester en local

Servir le dossier avec n'importe quel serveur statique (les modules JavaScript ne marchent pas en ouvrant le fichier directement), par exemple `npx serve`.
