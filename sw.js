// Garde l'application sur l'appareil pour jouer sans réseau.
// Changer VERSION à chaque mise en ligne pour que les appareils récupèrent la nouvelle version.
importScripts("js/core/images-list.js");
const VERSION = "boite-a-jeux-0.29.0";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "css/app.css",
  "js/main.js",
  "js/screens.js",
  "js/album.js",
  "js/core/art.js",
  "js/core/sound.js",
  "js/core/store.js",
  "js/core/ui.js",
  "js/core/stage.js",
  "js/core/orientation.js",
  "js/core/images-list.js",
  "js/core/stickers.js",
  "js/core/pictos.js",
  "js/games/index.js",
  "js/games/top-depart.js",
  "js/games/sumo-bulles.js",
  "js/games/les-canons.js",
  "js/games/astro-balles.js",
  "js/games/course-grenouilles.js",
  "js/games/panier-fruits.js",
  "js/games/tir-etoiles.js",
  "js/games/serpentins.js",
  "js/games/patate-chaude.js",
  "js/games/calcul-eclair.js",
  "js/games/oeil-de-lynx.js",
  "js/games/paires-cachees.js",
  "js/games/petits-bolides.js",
  "js/games/palet-glissant.js",
  "js/games/quatre-a-la-suite.js",
  "js/games/tour-bancale.js",
  "js/games/orchestre.js",
  ...self.ASSET_IMAGES.map(path => "assets/" + path)
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const font = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !font) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok || response.type === "opaque") {
        const copy = response.clone();
        caches.open(VERSION).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => cached))
  );
});
