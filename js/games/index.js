// Catalogue des jeux. Pour en ajouter un : créer son module et l'ajouter ici.
import topDepart from "./top-depart.js";
import sumoBulles from "./sumo-bulles.js";
import lesCanons from "./les-canons.js";

export const GAMES = [topDepart, sumoBulles, lesCanons];

export const gameById = id => GAMES.find(game => game.id === id);
