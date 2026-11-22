// Catalogue des jeux. Pour en ajouter un : créer son module et l'ajouter ici.
import topDepart from "./top-depart.js";

export const GAMES = [topDepart];

export const gameById = id => GAMES.find(game => game.id === id);
