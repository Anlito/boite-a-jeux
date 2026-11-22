// Bruitages synthétisés (aucun fichier à télécharger) et voix du navigateur.
import { store } from "./store.js";

let audio = null;

export function unlockAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume().catch(() => {});
}

function note(frequency, start, duration, { type = "sine", volume = 0.14, slide = 1 } = {}) {
  const t = audio.currentTime + start;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * slide, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const SOUNDS = {
  tap: () => note(620, 0, 0.08, { type: "triangle", volume: 0.1, slide: 1.3 }),
  pop: () => note(440, 0, 0.12, { type: "sine", volume: 0.12, slide: 1.8 }),
  go: () => { note(880, 0, 0.18, { type: "square", volume: 0.07 }); note(1320, 0.02, 0.2, { volume: 0.1 }); },
  trap: () => note(300, 0, 0.16, { type: "triangle", volume: 0.1, slide: 0.8 }),
  wrong: () => { note(170, 0, 0.28, { type: "sawtooth", volume: 0.07, slide: 0.7 }); note(120, 0.05, 0.3, { type: "square", volume: 0.04 }); },
  point: () => [660, 880, 1100].forEach((f, i) => note(f, i * 0.07, 0.16, { type: "triangle", volume: 0.11 })),
  star: () => note(1200, 0, 0.25, { type: "sine", volume: 0.12, slide: 1.5 }),
  tick: () => note(520, 0, 0.09, { type: "sine", volume: 0.1 }),
  win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => note(f, i * 0.11, i === 5 ? 0.5 : 0.16, { type: "triangle", volume: 0.12 }))
};

export function play(name) {
  if (!store.settings.sound || !audio || audio.state !== "running") return;
  SOUNDS[name]?.();
}

let voice = null;
function frenchVoice() {
  if (voice || !window.speechSynthesis) return voice;
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => v.lang === "fr-FR" && /google|amélie|amelie|audrey|denise/i.test(v.name))
    || voices.find(v => v.lang?.startsWith("fr")) || null;
  return voice;
}
window.speechSynthesis?.addEventListener?.("voiceschanged", () => { voice = null; frenchVoice(); });

export function say(text) {
  if (!store.settings.voice || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const line = new SpeechSynthesisUtterance(text);
  line.lang = "fr-FR";
  line.voice = frenchVoice();
  line.rate = 1.05;
  line.pitch = 1.15;
  speechSynthesis.speak(line);
}

export function hush() {
  window.speechSynthesis?.cancel();
}
