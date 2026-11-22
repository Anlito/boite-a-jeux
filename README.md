# La boîte à jeux

Mini-jeux pour enfants, à jouer seul, contre un robot ou jusqu'à 4 sur le même téléphone ou la même tablette.
Application web installable, sans compte, sans publicité, qui fonctionne hors ligne.

## Jeux

| Jeu | Joueurs | État |
| --- | --- | --- |
| Top départ | 1 à 4, robots | Jouable |
| Sumo-bulles | 1 à 4, robots | Jouable |
| Les canons | 1 à 4, robots, chacun son tour | Jouable |

## Organisation

- `index.html`, `css/app.css` : la page et la charte graphique.
- `js/main.js` : navigation entre les écrans.
- `js/screens.js` : écrans communs (accueil, nombre de joueurs, qui joue, règles, partie, podium).
- `js/album.js` et `js/core/stickers.js` : pièces et album d'autocollants (44 autocollants en 3 raretés, pochette à 5 pièces, un doublon rend une pièce).
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
  theme: { bg, ink },      // couleurs de sa vignette
  vignette: () => "<svg…>",
  rules: { text: session => "…", demo: session => ({ node, stop }) },
  mount(root, ctx)         // ctx.seats, ctx.count, ctx.finish(result)
                           // renvoie { start, pause, resume, destroy }
};
```

`ctx.finish` reçoit soit `{ ranking: [{ seat, score, label? }] }` (à plusieurs), soit `{ solo: { stars, value, lowerIsBetter, label, speech, format, next } }`.

## Visuels

Les images viennent du brief donné à ChatGPT (voir le cahier des charges). Lot 1 intégré : mascotte, 12 avatars, 3 robots, icônes, décors, effets.

Pour ajouter un lot : réduire les images à la taille affichée (personnages 512 px, icônes 128 px, effets 256 px, décors en JPG 1600 px), les placer dans `assets/` avec les noms du brief, puis les ajouter à `js/core/images-list.js`. Elles remplacent alors le dessin vectoriel de même nom et sont gardées pour le hors-ligne. Les icônes livrées sont violettes : elles ne servent que sur fond clair, les boutons colorés gardent les icônes vectorielles blanches.

## Tester en local

Servir le dossier avec n'importe quel serveur statique (les modules JavaScript ne marchent pas en ouvrant le fichier directement), par exemple `npx serve`.
