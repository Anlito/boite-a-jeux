// Catalogue des jeux. Pour en ajouter un : créer son module et l'ajouter ici.
import topDepart from "./top-depart.js";
import sumoBulles from "./sumo-bulles.js";
import lesCanons from "./les-canons.js";
import astroBalles from "./astro-balles.js";
import courseGrenouilles from "./course-grenouilles.js";
import panierFruits from "./panier-fruits.js";
import tirEtoiles from "./tir-etoiles.js";

export const GAMES = [topDepart, sumoBulles, lesCanons, astroBalles, courseGrenouilles, panierFruits, tirEtoiles];

export const gameById = id => GAMES.find(game => game.id === id);
