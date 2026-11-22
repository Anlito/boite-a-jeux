import { unlockAudio, hush } from "./core/sound.js";
import * as screens from "./screens.js";

const root = document.getElementById("app");
let leave = null;

export const app = {
  go(name, params = {}) {
    hush();
    leave?.();
    leave = null;
    document.querySelectorAll(".modal-layer").forEach(layer => layer.remove());
    const view = screens[name](app, params);
    root.replaceChildren(view.node);
    root.dataset.screen = name;
    leave = view.leave || null;
    view.ready?.();
    window.scrollTo(0, 0);
  }
};

// Le son ne peut démarrer qu'après un premier geste de l'enfant.
document.addEventListener("pointerdown", unlockAudio, { capture: true });
document.addEventListener("keydown", unlockAudio, { capture: true });
// Pas de menu au doigt long, pas de zoom au double tap.
document.addEventListener("contextmenu", event => event.preventDefault());
document.addEventListener("dblclick", event => event.preventDefault());

app.go("home");

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
