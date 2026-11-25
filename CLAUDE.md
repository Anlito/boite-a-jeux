# La boîte à jeux : où on en est (à lire en début de conversation)

Ce fichier sert à reprendre le travail dans une nouvelle conversation sans tout réexpliquer.
**Le tenir à jour à la fin de chaque tâche** (jeux ajoutés, lots d'images reçus, retours en attente).

## Le projet

- Application web installable (PWA) de mini-jeux pour enfants. Contenus scolaires au niveau CE2 au plus (additions, soustractions jusqu'à 100, tables de 2 et 3), avec toujours un niveau « petit » pour un enfant plus jeune.
- Un jeu se joue seul (10 niveaux + défi libre), contre des robots, ou de 1 à 4 sur le même écran (simultané ou chacun son tour). Coup de pouce pour le plus petit. Pièces à gagner, album d'autocollants.
- En ligne : https://anlito.github.io/boite-a-jeux/ (dépôt GitHub `Anlito/boite-a-jeux`, branche `main`, GitHub Pages).
- Fiche sur la page perso : https://anlito.github.io/perso/ (dépôt `Anlito/anlito.github.io`, fichier `perso/index.html`, section « Pour les enfants »). **Pas** la page des outils de classe.
- Tout en français, vocabulaire simple, sans jargon.
- Le README décrit l'organisation du code et l'interface d'un jeu (`mount`, `levels`, `finish`).

## État actuel (version 0.24.0, fin novembre 2026)

17 jeux en ligne :

| Jeu | Fichier | Images ChatGPT |
| --- | --- | --- |
| Top départ | `top-depart.js` | lot 3 |
| Sumo-bulles | `sumo-bulles.js` | lot 4 |
| Les canons | `les-canons.js` | lot 5 |
| Astro-balles | `astro-balles.js` | lot 8 |
| Course des grenouilles | `course-grenouilles.js` | lot 7 |
| Panier de fruits | `panier-fruits.js` | lot 6 |
| Tir aux étoiles | `tir-etoiles.js` | lot 9 |
| Serpentins (joystick) | `serpentins.js` | lot 10 |
| Patate chaude | `patate-chaude.js` | lot 11 |
| Calcul-éclair | `calcul-eclair.js` | lot 12 |
| Œil de lynx (principe du Dobble) | `oeil-de-lynx.js` | **lot 13 attendu** (pictos), emojis en attendant |
| Paires cachées (mémoire) | `paires-cachees.js` | **lots 13 et 14 attendus**, emojis en attendant |
| Petits bolides (course, joystick) | `petits-bolides.js` | **lot 15 attendu** |
| Palet glissant (1-2) | `palet-glissant.js` | pas de lot prévu |
| Quatre à la suite (1-2) | `quatre-a-la-suite.js` | pas de lot prévu |
| La tour bancale | `tour-bancale.js` | pas de lot prévu |
| L'orchestre | `orchestre.js` | pas de lot prévu |

Lot 1 (mascotte, 12 avatars, 3 robots, icônes) et lot 2 (14 vignettes) intégrés.
**Vignettes manquantes** : Œil de lynx, Paires cachées (lot 16), Palet glissant, Quatre à la suite (dessin SVG en attendant ; pas encore dans le brief).

## Ce qu'attend ChatGPT

Le brief complet est dans [docs/brief-visuels-lots-6-16.md](docs/brief-visuels-lots-6-16.md) (paragraphe de style à coller en tête de chaque demande, puis un lot par jeu). L'utilisateur l'a déjà transmis à ChatGPT.
Restent à recevoir : **lot 13** (48 pictos), **lot 14** (Paires cachées), **lot 15** (Petits bolides), **lot 16** (2 vignettes).
À ajouter au brief si l'utilisateur le souhaite : vignettes de Palet glissant et Quatre à la suite, et un lot pour La tour bancale / L'orchestre.

## Jeux encore possibles (proposés, pas faits)

Prévu au cahier des charges : **Cherche et trouve** (scènes à faire dessiner par ChatGPT).
Proposés : Le grand tir à la corde (2-4), Échelles et toboggans (2-4, dé), Boules de neige (pétanque sur glace), Devine mon dessin, La bille du labyrinthe (inclinaison), La pêche aux poissons, Les 7 différences (images ChatGPT), Attrape-mots (lecture, niveau par enfant).
Aussi prévus : un **mode Tournoi** (plusieurs jeux à la suite) et un **défi du jour**.
L'utilisateur a refusé de passer Panier de fruits en plateau unique (les fruits tombent dans un seul sens).

## Comment travailler

### Intégrer un lot d'images ChatGPT
1. Décompresser l'archive dans un dossier temporaire vide (jamais dans le dépôt), lire `liste.txt`, regarder les images (planche contact) et mesurer la partie visible de chaque PNG (fond vraiment transparent ?).
2. Réduire à la taille d'affichage (PowerShell System.Drawing) : personnages et objets 256 à 512 px, petites icônes 64 à 128 px, décors en JPG 1600 px de large (qualité 85). Ranger dans `assets/<jeu>/` avec les noms du brief.
3. Régénérer `js/core/images-list.js` : liste de tous les `.png`/`.jpg` de `assets/` (chemins relatifs à `assets/`, triés), sous `globalThis.ASSET_IMAGES = [ … ];` en gardant l'en-tête du fichier.
4. Dans le jeu : `hasImage("dossier/nom.png")` puis `artImage('<img src="' + imagePath(...) + '">')` (jeux sur canvas) ou une balise `<img>` (jeux en HTML). Toujours **garder l'ancien dessin en secours** si l'image manque. Utiliser la partie visible mesurée pour caler l'image sur la zone de jeu.
5. Si une image ne convient pas telle quelle (décor fixe alors que le terrain change de forme, élément qui doit bouger), l'adapter ou reprendre ses couleurs dans le dessin, et le dire à l'utilisateur.

### Mettre en ligne (à chaque changement)
1. `sw.js` : augmenter `VERSION` (0.x.y) ; ajouter tout nouveau fichier JS à la liste `SHELL`.
2. Nouveau jeu : l'importer dans `js/games/index.js` ; ligne dans le tableau du README ; mettre à jour la ligne « Lots … intégrés » du README pour un lot.
3. Commit en français (titre court + version), puis `git push` sur `main` ; vérifier que https://anlito.github.io/boite-a-jeux/sw.js sert la nouvelle version.
4. Nouveau jeu : mettre à jour la description de la fiche dans `../anlito.github.io/perso/index.html` (nombre de jeux) et une ligne datée en tête du journal de son `README.md`. **Ce fichier est en fins de ligne CRLF** : après une modification avec sed, les remettre (`sed -i 's/\r\?$/\r/'`) et vérifier que `git diff --stat` ne touche qu'une ligne.

### Tester
- Servir le dossier en local (les modules ne marchent pas en ouvrant le fichier) : `node outils/serve.js . 8812`, déclaré dans `.claude/launch.json` sous le nom `boite-a-jeux` pour l'aperçu du navigateur intégré.
- Lancer un écran directement depuis la console : `const { app } = await import('/js/main.js'); const { gameById } = await import('/js/games/index.js');` puis `app.go('play', { session: { game: gameById('id'), count, seats: [{ kind: 'human', profileId, boost: 0 }, { kind: 'robot', level: 2 }], level: 0 } })` (profils dans `localStorage['boite-a-jeux.v1']`).
- Le navigateur de test tourne au ralenti et sans son : tester les règles par des parties automatiques (événements pointer simulés), et regarder téléphone debout (375 × 812), couché (812 × 375) et tablette (768 × 1024). Remettre la taille « desktop » à la fin.
- Dire clairement ce qui n'a pas été vérifié sur un vrai appareil.

### À savoir
- Pas de demande de plein écran (Chrome affichait un message par-dessus le jeu) ; les jeux en largeur s'affichent tournés si le téléphone est debout (`js/core/orientation.js`).
- Le bas de l'écran est réservé aux gestes du téléphone : ne pas y mettre de zone où l'on glisse le doigt (voir la bande du panier).
- Joysticks : visibles, dans le coin de chaque joueur, hors du terrain de jeu (Serpentins, Petits bolides).
- Suppression d'un joueur : dans Réglages (accueil), avec confirmation.
