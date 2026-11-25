// La tour bancale : un étage se balance au bout de la grue ; on touche l'écran pour le lâcher.
// Il doit tomber sur l'étage du dessous. Trop décalé : il tombe à côté. Et si la tour penche trop d'un côté,
// elle s'écroule ! Seul : la tour la plus haute possible. À plusieurs : chacun son tour sur la même tour.
import { SEATS, robotArt, hasImage, imagePath } from "../core/art.js";
import { play, say } from "../core/sound.js";
import { h } from "../core/ui.js";
import { createStage, createLoop, artImage, text, createParticles } from "../core/stage.js";

const W = 1000, H = 1600;
const BH = 92;                    // hauteur d'un étage
const GROUND = 1440;              // sol, à l'écran, quand la tour est basse
const HOOK_Y = 330;               // hauteur du crochet à l'écran
const LIVES = 3;
const MULTI_ROUNDS = 8;           // étages par joueur à plusieurs
const INK = "#2B2350";
const FLOOR_COLORS = ["#FF9AA8", "#FFD36B", "#8FD6A7", "#8EC5FF", "#C5A8FF", "#FFB27A"];

// Niveaux solo : vitesse et ampleur du balancement, largeur des étages (et sa variation), vent,
// étages à atteindre pour 1, 2, 3 étoiles.
const LEVELS = [
  { speed: 1.5, amp: 230, width: 250, vary: 0, wind: 0, stars: [4, 7, 10], goal: "Touche l'écran pour lâcher l'étage sur la tour. Vise bien le milieu !" },
  { speed: 1.7, amp: 250, width: 240, vary: 0, wind: 0, stars: [5, 8, 12], goal: "Un étage bien au milieu, c'est « Parfait ! » et ça compte double." },
  { speed: 1.9, amp: 270, width: 230, vary: 0.15, wind: 0, stars: [6, 10, 14], goal: "Des étages de tailles différentes. Attention à l'équilibre !" },
  { speed: 2.0, amp: 280, width: 225, vary: 0, wind: 70, goal: "Le vent pousse la grue d'un côté. Regarde bien où elle va !", stars: [6, 10, 14] },
  { speed: 2.2, amp: 290, width: 215, vary: 0.2, wind: 0, stars: [7, 11, 16], goal: "Ça va plus vite ! Garde ta tour bien droite." },
  { speed: 2.3, amp: 300, width: 210, vary: 0.15, wind: 90, stars: [7, 11, 16], goal: "Vent et étages bizarres." },
  { speed: 2.5, amp: 310, width: 205, vary: 0.25, wind: 60, stars: [8, 12, 18], goal: "La tour penche vite : rattrape-la avec les étages suivants !" },
  { speed: 2.7, amp: 320, width: 200, vary: 0.2, wind: 120, stars: [8, 12, 18], goal: "Grand vent sur le chantier !" },
  { speed: 2.9, amp: 330, width: 190, vary: 0.3, wind: 110, stars: [9, 14, 20], goal: "Presque le niveau des champions." },
  { speed: 3.1, amp: 340, width: 185, vary: 0.35, wind: 140, stars: [10, 15, 22], goal: "Le défi des champions : la tour la plus haute du monde !" }
];
const FREE = { speed: 1.8, amp: 260, width: 235, vary: 0.2, wind: 60, stars: [8, 14, 20], endless: true };
const MULTI = { speed: 2.0, amp: 280, width: 230, vary: 0.2, wind: 60 };
// Robot : il lâche quand le crochet passe près du bon endroit, avec plus ou moins d'erreur.
const ROBOT = { 1: { error: 55, miss: 0.18 }, 2: { error: 28, miss: 0.07 }, 3: { error: 10, miss: 0.02 } };

const between = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const clamp01 = v => Math.max(0, Math.min(1, v));

// Images du lot 18 (sinon : les dessins de secours plus bas).
const pic = name => hasImage(`tour-bancale/${name}`) ? artImage(`<img src="${imagePath(`tour-bancale/${name}`)}">`) : null;
const ready = image => !!(image && image.complete && image.naturalWidth);
// Couleur d'un étage → image (à plusieurs, l'étage prend la couleur du joueur : on prend l'image la plus proche).
const FLOOR_PIC = {
  "#FF9AA8": "rose", "#FFD36B": "jaune", "#8FD6A7": "vert", "#8EC5FF": "bleu", "#C5A8FF": "violet", "#FFB27A": "orange",
  "#2F80ED": "bleu", "#EB5757": "rose", "#27AE60": "vert", "#F2C94C": "jaune"
};
// Repères mesurés sur les images d'origine (768 × 256) : partie visible de l'étage, en hauteur et en largeur,
// et les 4 tranches à fenêtre (144 px chacune), entre deux petits bords.
const SRC = { w: 768, top: 25, h: 205, left: 76, cap: 20, cell: 144, cells: 4 };
const VILLE_GROUND = 1736;        // ligne du sol dans fond-ville.jpg (1080 × 1920)
const SKY_DAY = "#BBECFD";        // couleur du haut de fond-ville.jpg

function mount(root, ctx) {
  const solo = ctx.count === 1;
  const level = ctx.level;
  const rules = solo ? (level || FREE) : MULTI;
  const players = ctx.seats.map((p, i) => ({ seat: i, p, points: 0, lives: LIVES, drops: 0 }));
  const stage = createStage(root, { width: W, height: H, background: "#BFE6FF" });
  const g = stage.ctx;
  const particles = createParticles();
  const banner = h(`<div class="cn-overlay"><div class="cn-banner" hidden><span class="cn-banner-art"></span><span class="cn-banner-text"></span></div></div>`);
  root.append(banner);
  const bannerBox = banner.querySelector(".cn-banner");
  const pics = {
    floors: Object.fromEntries([...new Set(Object.values(FLOOR_PIC))].map(name => [name, pic(`etage-${name}.png`)])),
    base: pic("socle.png"), roof: pic("toit.png"), hook: pic("crochet.png"), crane: pic("grue.png"),
    cloud: pic("nuage.png"), town: pic("fond-ville.jpg"), space: pic("fond-espace.jpg")
  };

  // La tour : étages posés (x du centre, largeur, couleur, qui l'a posé). Le premier est le socle.
  const tower = [{ x: W / 2, w: 300, color: "#B8A6E8", seat: -1, base: true }];
  let turn = -1, phase = "banner", timer = 1.2, clock = 0, swing = 0, camera = 0, cameraTarget = 0;
  let falling = null, flying = [], current = null, message = null, perfect = 0, lean = 0, gameOver = false;
  const height = () => tower.length - 1;                     // étages posés (sans le socle)
  const topOf = () => tower[tower.length - 1];

  /* ---------- Tours de jeu ---------- */

  function newBlock() {
    const w = rules.width * (1 + between(-rules.vary, rules.vary));
    current = { w, color: solo ? FLOOR_COLORS[height() % FLOOR_COLORS.length] : players[turn].p.color };
  }

  function nextTurn() {
    if (gameOver) return;
    const alive = players.filter(pl => solo ? pl.lives > 0 : pl.drops < MULTI_ROUNDS);
    if (!alive.length) return finish();
    do { turn = (turn + 1) % players.length; } while (!(solo ? players[turn].lives > 0 : players[turn].drops < MULTI_ROUNDS));
    newBlock();
    phase = "banner";
    timer = solo && height() > 0 ? 0.25 : 1.1;
    const pl = players[turn];
    if (solo && height() > 0) return;
    bannerBox.hidden = false;
    bannerBox.style.setProperty("--seat", pl.p.color);
    bannerBox.querySelector(".cn-banner-art").innerHTML = pl.p.art;
    bannerBox.querySelector(".cn-banner-text").textContent = solo ? "Construis !" : pl.p.kind === "robot" ? `Au tour de ${pl.p.label}` : `À toi, ${pl.p.label} !`;
    if (!solo && pl.p.kind === "human") say(`À toi, ${pl.p.label} !`);
    play("pop");
  }

  // Position du crochet : balancement, plus ample et plus rapide en montant, poussé par le vent.
  function hookX() {
    const boost = 1 + Math.min(0.4, height() * 0.02);
    return W / 2 + Math.sin(swing) * rules.amp * Math.min(1.25, boost) + (rules.wind ? Math.sin(clock * 0.4) * rules.wind : 0);
  }

  function release() {
    if (phase !== "swing") return;
    phase = "falling";
    falling = { x: hookX(), y: HOOK_Y + 40, vy: 0, w: current.w, color: current.color, seat: turn };
    players[turn].drops++;
    play("tap");
  }

  // L'étage arrive sur la tour : posé, parfait, ou à côté ?
  function land() {
    const top = topOf(), f = falling;
    falling = null;
    const offset = f.x - top.x;
    const pl = players[turn];
    if (Math.abs(offset) > top.w / 2) {
      // Son milieu est dans le vide : il bascule et tombe.
      flying.push({ x: f.x, y: screenTopY() - BH / 2, vx: Math.sign(offset) * 140, vy: -120, spin: 0, w: f.w, color: f.color });
      pl.lives = solo ? pl.lives - 1 : pl.lives;
      message = { text: "À côté !", time: 1.2 };
      play("wrong");
      if (!solo) pl.points = Math.max(0, pl.points - 1);
      afterLanding();
      return;
    }
    const isPerfect = Math.abs(offset) < 10;
    tower.push({ x: isPerfect ? top.x : f.x, w: f.w, color: f.color, seat: f.seat });
    pl.points += isPerfect ? 2 : 1;
    if (isPerfect) { perfect++; message = { text: "Parfait !", time: 1 }; play("star"); }
    else play("point");
    particles.burst(f.x, screenTopY() - BH / 2, "#ffffff", { count: 12, speed: 240, size: 7, life: 0.4 });
    cameraTarget = Math.max(0, (height() - 5) * BH);
    // La tour tient-elle encore ? On regarde l'équilibre de chaque étage.
    const fall = collapseAt();
    if (fall > 0) return collapse(fall);
    afterLanding();
  }

  // Premier étage qui ne tient plus : le centre de gravité de tout ce qui est au-dessus sort de son appui.
  function collapseAt() {
    for (let k = tower.length - 1; k >= 1; k--) {
      const above = tower.slice(k);
      const com = above.reduce((sum, b) => sum + b.x * b.w, 0) / above.reduce((sum, b) => sum + b.w, 0);
      const support = tower[k - 1];
      if (Math.abs(com - support.x) > support.w / 2) return k;
    }
    return 0;
  }

  // Penchement de la tour (pour le dessin) : plus le centre de gravité s'éloigne, plus elle penche.
  function updateLean() {
    let worst = 0;
    for (let k = tower.length - 1; k >= 1; k--) {
      const above = tower.slice(k);
      const com = above.reduce((sum, b) => sum + b.x * b.w, 0) / above.reduce((sum, b) => sum + b.w, 0);
      worst = Math.max(worst, Math.abs(com - tower[k - 1].x) / (tower[k - 1].w / 2));
    }
    return worst;
  }

  function collapse(k) {
    const pl = players[turn];
    message = { text: "Badaboum !", time: 2 };
    play("trap");
    setTimeout(() => play("wrong"), 150);
    const dir = Math.sign(tower.slice(k).reduce((s, b) => s + b.x, 0) / (tower.length - k) - tower[k - 1].x) || 1;
    tower.splice(k).forEach((b, i) => flying.push({ x: b.x, y: GROUND + camera - (k + i) * BH, vx: dir * between(120, 260), vy: -between(60, 220), spin: 0, w: b.w, color: b.color, fromFloor: k + i }));
    if (!solo) pl.points = Math.max(0, pl.points - 3);
    gameOver = true;
    phase = "collapse";
    timer = 2.2;
  }

  function afterLanding() {
    lean = updateLean();
    phase = "pause";
    timer = 0.7;
    if (solo && players[0].lives <= 0) { gameOver = true; timer = 1.4; }
    if (solo && level && !rules.endless && height() >= rules.stars[2]) { gameOver = true; timer = 1.2; message = { text: "Bravo !", time: 1.5 }; play("win"); }
  }

  function finish() {
    phase = "done";
    if (solo) {
      const floors = height();
      const stars = rules.stars.filter(need => floors >= need).length;
      ctx.finish({
        solo: {
          stars, value: floors, lowerIsBetter: false,
          format: v => `${v} étage${v > 1 ? "s" : ""}`,
          label: `Une tour de ${floors} étage${floors > 1 ? "s" : ""}${perfect ? ` · ${perfect} parfait${perfect > 1 ? "s" : ""}` : ""}`,
          speech: floors >= rules.stars[2] ? "Quelle tour magnifique !" : `${floors} étages !`,
          next: stars === 3 ? "" : `${stars + 1} étoile${stars ? "s" : ""} : ${rules.stars[stars]} étages`
        }
      });
      return;
    }
    ctx.finish({ ranking: players.map(pl => ({ seat: pl.seat, score: pl.points, label: `${pl.points} point${pl.points > 1 ? "s" : ""}` })) });
  }

  /* ---------- Commandes ---------- */

  const onDown = event => {
    if (phase !== "swing" || players[turn].p.kind !== "human") return;
    event.preventDefault();
    release();
  };
  stage.canvas.addEventListener("pointerdown", onDown);
  const onKey = event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onDown(event); } };
  document.addEventListener("keydown", onKey);

  /* ---------- Boucle ---------- */

  const screenTopY = () => GROUND - height() * BH + camera;   // haut de la tour, à l'écran

  function update(dt) {
    clock += dt;
    particles.update(dt);
    camera += (cameraTarget - camera) * Math.min(1, dt * 3);
    swing += dt * rules.speed * (1 + Math.min(0.35, height() * 0.015));
    if (message && (message.time -= dt) <= 0) message = null;
    for (const b of flying) { b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * Math.sign(b.vx || 1) * 3; }
    flying = flying.filter(b => b.y < H + 200);
    if (phase === "banner") {
      timer -= dt;
      if (timer <= 0) { bannerBox.hidden = true; phase = "swing"; if (players[turn].p.kind === "robot") robotPlan(); }
      return;
    }
    if (phase === "swing" && players[turn].p.kind === "robot") robotThink();
    if (phase === "falling") {
      falling.vy += 2200 * dt;
      falling.y += falling.vy * dt;
      if (falling.y >= screenTopY() - BH) land();
      return;
    }
    if (phase === "pause" || phase === "collapse") {
      timer -= dt;
      if (timer <= 0) gameOver ? finish() : nextTurn();
    }
  }

  let plan = null;
  function robotPlan() {
    const brain = ROBOT[players[turn].p.level] || ROBOT[2];
    // Le robot vise un peu à côté du milieu pour rééquilibrer la tour, avec son erreur.
    const top = topOf();
    const above = tower.slice(1);
    const com = above.length ? above.reduce((s, b) => s + b.x * b.w, 0) / above.reduce((s, b) => s + b.w, 0) : top.x;
    const correct = (tower[0].x - com) * 0.4;
    plan = { x: top.x + correct + between(-brain.error, brain.error) + (Math.random() < brain.miss ? pickOne([-1, 1]) * top.w * 0.7 : 0), wait: between(0.4, 1.2) };
  }
  function robotThink() {
    if (!plan) return;
    plan.wait -= 1 / 60;
    if (plan.wait > 0) return;
    // On lâche quand le crochet passe près du point visé (en tenant compte du temps de chute).
    if (Math.abs(hookX() - plan.x) < 14) { plan = null; release(); }
  }

  /* ---------- Dessin ---------- */

  // Étage dessiné avec son image : les deux bords, puis autant de tranches à fenêtre que la largeur en demande
  // (les fenêtres gardent leur forme, l'étage est seulement un peu plus ou moins large entre elles).
  function drawFloorPic(image, w) {
    const k = image.naturalWidth / SRC.w, s = BH / SRC.h;
    const cap = SRC.cap * s, inner = w - cap * 2;
    const n = Math.max(1, Math.round(inner / (SRC.cell * s)));
    const cw = inner / n, sy = SRC.top * k, sh = SRC.h * k;
    g.drawImage(image, SRC.left * k, sy, SRC.cap * k, sh, -w / 2, -BH / 2, cap + 0.5, BH);
    for (let i = 0; i < n; i++) {
      const sx = (SRC.left + SRC.cap + SRC.cell * (i % SRC.cells)) * k;
      g.drawImage(image, sx, sy, SRC.cell * k, sh, -w / 2 + cap + i * cw - 0.3, -BH / 2, cw + 0.6, BH);
    }
    const right = SRC.left + SRC.cap + SRC.cell * SRC.cells;
    g.drawImage(image, right * k, sy, SRC.cap * k, sh, w / 2 - cap - 0.5, -BH / 2, cap + 0.5, BH);
  }

  function drawFloor(x, y, w, color, seat, rotation = 0) {
    const image = pics.floors[FLOOR_PIC[color]];
    if (ready(image)) {
      g.save(); g.translate(x, y); if (rotation) g.rotate(rotation);
      drawFloorPic(image, w);
      if (seat >= 0 && !solo) { g.fillStyle = players[seat].p.color; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(w / 2 - 20, BH / 2 - 18, 9, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.restore();
      return;
    }
    g.save(); g.translate(x, y); if (rotation) g.rotate(rotation);
    g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.roundRect(-w / 2, -BH / 2, w, BH, 14); g.fill(); g.stroke();
    // Fenêtres
    const n = Math.max(2, Math.floor(w / 70));
    for (let k = 0; k < n; k++) {
      const wx = -w / 2 + (k + 0.5) * (w / n);
      g.fillStyle = "#FFF8E0"; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.roundRect(wx - 16, -22, 32, 36, 8); g.fill(); g.stroke();
      g.fillStyle = "#8EC5FF66"; g.fillRect(wx - 14, -20, 28, 14);
    }
    // Liseré clair en haut
    g.fillStyle = "#ffffff66"; g.beginPath(); g.roundRect(-w / 2 + 8, -BH / 2 + 6, w - 16, 8, 4); g.fill();
    if (seat >= 0 && !solo) { g.fillStyle = players[seat].p.color; g.beginPath(); g.arc(w / 2 - 18, BH / 2 - 16, 8, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  // Décor en images : la ville posée sur le sol, puis le soir, puis l'espace qui se répète en montant.
  function drawBackdrop(night, groundY) {
    g.fillStyle = SKY_DAY; g.fillRect(0, 0, W, H);
    const scale = W / pics.town.naturalWidth, townH = pics.town.naturalHeight * scale;
    const townTop = groundY - VILLE_GROUND * scale;
    if (townTop < H) g.drawImage(pics.town, 0, townTop, W, townH);
    const evening = clamp01(1 - Math.abs(night - 0.45) / 0.25);
    if (evening > 0) {
      const dusk = g.createLinearGradient(0, 0, 0, H);
      dusk.addColorStop(0, "#7B61FF"); dusk.addColorStop(1, "#FFB27A");
      g.globalAlpha = evening * 0.55; g.fillStyle = dusk; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    }
    const dark = clamp01((night - 0.4) / 0.35);
    if (dark > 0 && ready(pics.space)) {
      const spaceH = pics.space.naturalHeight * (W / pics.space.naturalWidth);
      g.globalAlpha = dark;
      for (let y = (camera * 0.3) % spaceH - spaceH; y < H; y += spaceH) g.drawImage(pics.space, 0, y, W, spaceH + 1);
      g.globalAlpha = 1;
    }
  }

  function draw() {
    stage.begin();
    // Ciel qui change en montant : jour, soir, puis l'espace
    const hgt = height();
    const night = Math.min(1, hgt / 25);
    const groundY = GROUND + BH / 2 + camera;
    const pictured = ready(pics.town);
    if (pictured) drawBackdrop(night, groundY);
    else drawSky(night, groundY);
    drawScene(hgt);
  }

  // Ciel, nuages, ville et sol dessinés (sans les images).
  function drawSky(night, groundY) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, night > 0.6 ? "#2B2350" : night > 0.3 ? "#7B61FF" : "#8EC5FF");
    sky.addColorStop(1, night > 0.6 ? "#7B61FF" : night > 0.3 ? "#FFB27A" : "#E3F4FF");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (night > 0.5) for (let k = 0; k < 40; k++) { g.fillStyle = "#ffffffaa"; g.beginPath(); g.arc((k * 197) % W, (k * 131) % (H * 0.7), 2.2, 0, Math.PI * 2); g.fill(); }
    // Sol et ville au loin
    if (groundY < H + 40) {
      g.fillStyle = "#B8D7FF";
      for (let k = 0; k < 8; k++) { const bw = 90 + (k * 37) % 60, bh = 140 + (k * 53) % 160; g.fillRect(k * 130 - 10, groundY - bh, bw, bh); }
      g.fillStyle = "#8FC46E"; g.fillRect(0, groundY, W, H - groundY + 10);
      g.fillStyle = INK; g.fillRect(0, groundY - 3, W, 6);
    }
  }

  function drawScene(hgt) {
    // Nuages qui descendent quand on monte (ils s'effacent dans l'espace)
    const cloudy = ready(pics.cloud);
    g.globalAlpha = cloudy ? 1 - clamp01((hgt / 25 - 0.5) / 0.3) * 0.85 : 1;
    g.fillStyle = "#ffffffcc";
    for (let k = 0; k < 6; k++) {
      const y = ((k * 380 + camera * 0.5) % (H + 300)) - 150, x = (k * 331) % (W - 200) + 100;
      if (cloudy) { const cw = 170 + (k % 3) * 30; g.drawImage(pics.cloud, x - 20, y - cw * 0.3, cw, cw / 2); continue; }
      for (const [dx, dy, r] of [[0, 0, 40], [38, -14, 32], [70, 4, 30]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    // La tour (elle penche un peu quand elle est mal équilibrée)
    g.save();
    const baseY = GROUND + camera;
    const tilt = lean > 0.55 ? Math.sin(clock * 6) * 0.012 * lean : 0;
    g.translate(tower[0].x, baseY + BH / 2); g.rotate(tilt); g.translate(-tower[0].x, -(baseY + BH / 2));
    tower.forEach((b, i) => {
      const y = baseY - i * BH;
      if (y < -BH || y > H + BH) return;
      if (b.base && ready(pics.base)) {
        const k = pics.base.naturalWidth / SRC.w;
        g.drawImage(pics.base, SRC.left * k, SRC.top * k, (SRC.cap * 2 + SRC.cell * SRC.cells) * k, SRC.h * k, b.x - b.w / 2, y - BH / 2, b.w, BH);
        return;
      }
      if (b.base) { g.fillStyle = "#8C7BB8"; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(b.x - b.w / 2, y - BH / 2, b.w, BH, 10); g.fill(); g.stroke(); return; }
      drawFloor(b.x, y, b.w, b.color, b.seat);
    });
    // Toit sur le dernier étage
    if (height() > 0 && ready(pics.roof)) {
      // Le toit déborde de chaque côté, comme sur l'image (son bas fait toute la largeur, l'étage 616 px sur 768).
      const top = topOf(), y = baseY - height() * BH - BH / 2;
      const k = pics.roof.naturalWidth / SRC.w, rw = top.w * SRC.w / (SRC.cap * 2 + SRC.cell * SRC.cells), rh = rw * 206 / SRC.w;
      g.drawImage(pics.roof, 0, 50 * k, SRC.w * k, 206 * k, top.x - rw / 2, y + 4 - rh, rw, rh);
    } else if (height() > 0) {
      const top = topOf(), y = baseY - height() * BH - BH / 2;
      g.fillStyle = "#EB5757"; g.strokeStyle = INK; g.lineWidth = 5;
      g.beginPath(); g.moveTo(top.x - top.w / 2 - 6, y + 2); g.lineTo(top.x, y - 40); g.lineTo(top.x + top.w / 2 + 6, y + 2); g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
    if (lean > 0.75 && phase === "swing") text(g, "Attention, elle penche !", W / 2, H * 0.55, { size: 44, color: "#fff", stroke: "#C62F2F" });
    // Étages qui tombent
    for (const b of flying) drawFloor(b.x, b.y, b.w, b.color, -1, b.spin);
    // Grue et étage accroché
    if (ready(pics.crane)) {
      // Bras en treillis qui se répète ; sa partie visible (100 px sur 128) fait 40 de haut, centrée sur y = 137.
      const th = 40 * 128 / 100, tw = th * pics.crane.naturalWidth / pics.crane.naturalHeight;
      for (let x = -20; x < W; x += tw - 1) g.drawImage(pics.crane, x, 137 - th / 2, tw, th);
    } else {
      g.fillStyle = "#FFC83D"; g.strokeStyle = INK; g.lineWidth = 5;
      g.beginPath(); g.roundRect(-20, 120, W + 40, 34, 10); g.fill(); g.stroke();
      for (let x = 20; x < W; x += 60) { g.beginPath(); g.moveTo(x, 122); g.lineTo(x + 30, 152); g.stroke(); }
    }
    if (phase === "swing" || phase === "banner") {
      const hx = hookX();
      const hooked = ready(pics.hook);
      // Le chariot roule sur le bras ; le câble part du bout du crochet.
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(hx, hooked ? 200 : 154); g.lineTo(hx, HOOK_Y); g.stroke();
      if (hooked) g.drawImage(pics.hook, hx - 60, 100, 120, 120);
      else { g.fillStyle = "#8C86A6"; g.beginPath(); g.roundRect(hx - 30, 140, 60, 26, 8); g.fill(); g.stroke(); }
      if (current) drawFloor(hx, HOOK_Y + BH / 2, current.w, current.color, -1, Math.sin(swing) * 0.06);
      // Repère pour viser : une ligne pointillée sous l'étage
      g.strokeStyle = "#ffffff99"; g.setLineDash([10, 12]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(hx, HOOK_Y + BH); g.lineTo(hx, screenTopY() - BH / 2); g.stroke(); g.setLineDash([]);
    }
    if (falling) drawFloor(falling.x, falling.y, falling.w, falling.color, -1);
    particles.draw(g);
    // Repères
    g.fillStyle = "#ffffffe6"; g.beginPath(); g.roundRect(W / 2 - 290, 24, 580, 72, 36); g.fill();
    if (solo) {
      text(g, `${hgt} étage${hgt > 1 ? "s" : ""}`, W / 2 - 110, 60, { size: 38 });
      text(g, "♥".repeat(Math.max(0, players[0].lives)) + "♡".repeat(LIVES - Math.max(0, players[0].lives)), W / 2 + 130, 62, { size: 40, color: "#EB5757" });
    } else {
      text(g, players.map(pl => `${pl.p.label} ${pl.points}`).join("  ·  "), W / 2, 60, { size: players.length > 2 ? 26 : 32 });
    }
    if (phase === "swing" && players[turn].p.kind === "human") text(g, "Touche pour lâcher !", W / 2, H - 60, { size: 40, color: "#fff", stroke: INK });
    if (message) text(g, message.text, W / 2, H * 0.42, { size: 80, color: "#fff", stroke: INK });
  }

  const loop = createLoop(dt => { update(dt); draw(); });

  return {
    start() { nextTurn(); loop.start(); say(solo ? "Construis la tour la plus haute !" : "Chacun son tour, construisez la tour !"); },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() { loop.stop(); stage.destroy(); document.removeEventListener("keydown", onKey); }
  };
}

function demo() {
  const node = h(`<div class="tb-demo"><span class="tb-demo-crane"></span><span class="tb-demo-block swing"></span><span class="tb-demo-block b1"></span><span class="tb-demo-block b2"></span><span class="tb-demo-base"></span></div>`);
  return { node, stop() {} };
}

export default {
  id: "tour-bancale",
  title: "La tour bancale",
  players: { min: 1, max: 4 },
  robots: true,
  theme: { bg: "#E3F4FF", ink: "#3B2F8A" },
  vignette: () => `<svg viewBox="0 0 160 120" aria-hidden="true">
    <rect x="10" y="10" width="140" height="10" rx="4" fill="#FFC83D" stroke="#2B2350" stroke-width="3"/>
    <line x1="96" y1="20" x2="96" y2="34" stroke="#2B2350" stroke-width="3"/>
    <rect x="70" y="34" width="52" height="18" rx="5" fill="#8EC5FF" stroke="#2B2350" stroke-width="3"/>
    <rect x="52" y="62" width="56" height="18" rx="5" fill="#FFD36B" stroke="#2B2350" stroke-width="3"/>
    <rect x="48" y="80" width="56" height="18" rx="5" fill="#FF9AA8" stroke="#2B2350" stroke-width="3"/>
    <rect x="40" y="98" width="70" height="14" rx="4" fill="#8C7BB8" stroke="#2B2350" stroke-width="3"/>
  </svg>`,
  rules: {
    text: session => session.count === 1
      ? "L'étage se balance au bout de la grue. Touche l'écran pour le lâcher pile sur la tour ! Trop à côté, il tombe. Et si la tour penche trop, badaboum !"
      : "Chacun son tour, touche l'écran pour lâcher ton étage sur la même tour. Un étage posé rapporte un point, deux s'il est parfait. Celui qui fait tomber la tour perd des points !",
    demo
  },
  levels: LEVELS,
  mount
};
