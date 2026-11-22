// Données gardées sur l'appareil uniquement (profils, réglages, records).
const KEY = "boite-a-jeux.v1";

const blank = () => ({
  profiles: [],
  settings: { sound: true, voice: true },
  last: {},      // dernier choix de joueurs, par jeu
  results: {}    // results[profileId][gameId] = { stars, best, wins, played }
});

let data = blank();
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && typeof saved === "object") data = { ...blank(), ...saved, settings: { ...blank().settings, ...saved.settings } };
} catch { /* stockage indisponible : on joue sans mémoire */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignoré */ }
}

export const store = {
  get profiles() { return data.profiles; },
  get settings() { return data.settings; },

  profile(id) { return data.profiles.find(p => p.id === id); },

  addProfile(avatar, name) {
    const profile = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), avatar, name };
    data.profiles.push(profile);
    save();
    return profile;
  },

  setting(name, value) {
    data.settings[name] = value;
    save();
  },

  lastSetup(gameId) { return data.last[gameId]; },
  rememberSetup(gameId, setup) {
    data.last[gameId] = setup;
    save();
  },

  result(profileId, gameId) {
    return data.results[profileId]?.[gameId] || { stars: 0, best: null, wins: 0, played: 0 };
  },

  // lowerIsBetter : vrai pour un temps de réaction, faux pour un score.
  record(profileId, gameId, { stars = 0, value = null, win = false, lowerIsBetter = false } = {}) {
    const byGame = (data.results[profileId] ||= {});
    const current = byGame[gameId] || { stars: 0, best: null, wins: 0, played: 0 };
    let newRecord = false;
    if (value !== null && value !== undefined) {
      const better = current.best === null || (lowerIsBetter ? value < current.best : value > current.best);
      // Un record n'est fêté que s'il bat un score précédent.
      if (better) { newRecord = current.best !== null; current.best = value; }
    }
    current.stars = Math.max(current.stars, stars);
    current.wins += win ? 1 : 0;
    current.played += 1;
    byGame[gameId] = current;
    save();
    return { newRecord, ...current };
  },

  /* Pièces et autocollants, par profil */

  coins(profileId) { return this.profile(profileId)?.coins || 0; },

  addCoins(profileId, amount) {
    const profile = this.profile(profileId);
    if (!profile || !amount) return;
    profile.coins = (profile.coins || 0) + amount;
    save();
  },

  stickers(profileId) { return this.profile(profileId)?.stickers || {}; },

  // Paie la pochette, colle les autocollants ; un doublon rend une pièce.
  // Renvoie [{ id, isNew }] ou null si pas assez de pièces.
  openPack(profileId, price, ids) {
    const profile = this.profile(profileId);
    if (!profile || (profile.coins || 0) < price) return null;
    profile.coins -= price;
    profile.stickers ||= {};
    const result = ids.map(id => {
      const isNew = !profile.stickers[id];
      profile.stickers[id] = (profile.stickers[id] || 0) + 1;
      if (!isNew) profile.coins += 1;
      return { id, isNew };
    });
    save();
    return result;
  },

  bestStars(gameId) {
    return Math.max(0, ...data.profiles.map(p => this.result(p.id, gameId).stars));
  }
};
