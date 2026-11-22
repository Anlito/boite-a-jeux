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

  /* Niveaux solo : meilleures étoiles par niveau */

  levelStars(profileId, gameId) {
    return data.results[profileId]?.[gameId]?.levels || {};
  },

  recordLevel(profileId, gameId, level, stars) {
    const byGame = (data.results[profileId] ||= {});
    const entry = (byGame[gameId] ||= { stars: 0, best: null, wins: 0, played: 0 });
    entry.levels ||= {};
    const before = entry.levels[level] || 0;
    entry.levels[level] = Math.max(before, stars);
    save();
    return { before, improved: stars > before };
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

  // Paie la pochette et colle les autocollants (les doubles s'ajoutent au tas).
  // Renvoie [{ id, isNew }] ou null si pas assez de pièces.
  openPack(profileId, price, ids) {
    const profile = this.profile(profileId);
    if (!profile || (profile.coins || 0) < price) return null;
    profile.coins -= price;
    profile.stickers ||= {};
    const result = ids.map(id => {
      const isNew = !profile.stickers[id];
      profile.stickers[id] = (profile.stickers[id] || 0) + 1;
      return { id, isNew };
    });
    save();
    return result;
  },

  // Nombre de doubles : chaque autocollant en plus du premier.
  doubles(profileId) {
    return Object.values(this.stickers(profileId)).reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  },

  // Vend `count` doubles contre une pièce. On retire d’abord les doubles des autocollants communs,
  // puis des plus nombreux ; on ne touche jamais au dernier exemplaire.
  sellDoubles(profileId, count, rarityOf) {
    const profile = this.profile(profileId);
    if (!profile || this.doubles(profileId) < count) return false;
    const rank = { commun: 0, rare: 1, brillant: 2 };
    for (let k = 0; k < count; k++) {
      const id = Object.keys(profile.stickers)
        .filter(key => profile.stickers[key] > 1)
        .sort((a, b) => (rank[rarityOf(a)] ?? 0) - (rank[rarityOf(b)] ?? 0) || profile.stickers[b] - profile.stickers[a])[0];
      profile.stickers[id]--;
    }
    profile.coins = (profile.coins || 0) + 1;
    save();
    return true;
  },

  bestStars(gameId) {
    return Math.max(0, ...data.profiles.map(p => this.result(p.id, gameId).stars));
  }
};
