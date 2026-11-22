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
  theme: { bg, ink },      // couleurs de sa vignette
  vignette: () => "<svg…>",
  rules: { text: session => "…", demo: session => ({ node, stop }) },
  mount(root, ctx)         // ctx.seats, ctx.count, ctx.finish(result)
                           // renvoie { start, pause, resume, destroy }
};
```

`ctx.finish` reçoit soit `{ ranking: [{ seat, score, label? }] }` (à plusieurs), soit `{ solo: { stars, value, lowerIsBetter, label, speech, format, next } }`.

## Visuels

Les dessins actuels sont faits en code. Quand les images du brief arrivent, les placer dans `assets/` avec les noms du brief, puis les déclarer dans `IMAGES` (`js/core/art.js`) : elles remplacent les dessins correspondants.

## Tester en local

Servir le dossier avec n'importe quel serveur statique (les modules JavaScript ne marchent pas en ouvrant le fichier directement), par exemple `npx serve`.
