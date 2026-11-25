// Catalogue des jeux. Pour en ajouter un : créer son module et l'ajouter ici.
import topDepart from "./top-depart.js";
import sumoBulles from "./sumo-bulles.js";
import lesCanons from "./les-canons.js";
import astroBalles from "./astro-balles.js";
import courseGrenouilles from "./course-grenouilles.js";
import panierFruits from "./panier-fruits.js";
import tirEtoiles from "./tir-etoiles.js";
import serpentins from "./serpentins.js";
import patateChaude from "./patate-chaude.js";
import calculEclair from "./calcul-eclair.js";
import oeilDeLynx from "./oeil-de-lynx.js";
import pairesCachees from "./paires-cachees.js";
import petitsBolides from "./petits-bolides.js";
import paletGlissant from "./palet-glissant.js";
import quatreALaSuite from "./quatre-a-la-suite.js";

export const GAMES = [topDepart, sumoBulles, lesCanons, astroBalles, courseGrenouilles, panierFruits, tirEtoiles, serpentins, patateChaude, calculEclair, oeilDeLynx, pairesCachees, petitsBolides, paletGlissant, quatreALaSuite];

export const gameById = id => GAMES.find(game => game.id === id);
