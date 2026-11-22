// Moteur partagé des jeux dessinés : terrain aux proportions fixes, boucle de jeu, images.

// Terrain de taille fixe (width × height), centré et mis à l'échelle sans jamais être déformé.
export function createStage(root, { width, height, background = "#2B2350" }) {
  const canvas = document.createElement("canvas");
  canvas.className = "stage";
  root.append(canvas);
  const ctx = canvas.getContext("2d");
  let scale = 1, ox = 0, oy = 0, dpr = 1, cw = 0, ch = 0;

  function fit() {
    const box = root.getBoundingClientRect();
    cw = box.width; ch = box.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    scale = Math.min(cw / width, ch / height);
    ox = (cw - width * scale) / 2;
    oy = (ch - height * scale) / 2;
  }
  const observer = new ResizeObserver(fit);
  observer.observe(root);
  fit();

  return {
    canvas, ctx, width, height,
    // À appeler au début de chaque image : efface et place le repère du terrain.
    begin() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    },
    // Coordonnées d'un doigt dans le repère du terrain.
    toWorld(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      return { x: (clientX - box.left - ox) / scale, y: (clientY - box.top - oy) / scale };
    },
    destroy() { observer.disconnect(); }
  };
}

// Boucle de jeu : step(dt) environ 60 fois par seconde, en secondes.
// Un minuteur de secours prend le relais si le navigateur ralentit les animations.
export function createLoop(step) {
  let running = false, last = 0, lastRun = 0, raf = 0, watchdog = 0;
  function run(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    lastRun = performance.now();
    step(dt);
  }
  function frame(now) {
    run(performance.now());
    raf = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
      watchdog = setInterval(() => { if (performance.now() - lastRun > 80) run(performance.now()); }, 33);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
    }
  };
}

// Transforme un dessin (SVG ou <img>) en image utilisable sur le terrain.
const images = new Map();
export function artImage(html) {
  if (images.has(html)) return images.get(html);
  const image = new Image();
  const src = html.match(/^<img[^>]*src="([^"]+)"/);
  if (src) image.src = src[1];
  else {
    const svg = html.includes("xmlns=") ? html : html.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  images.set(html, image);
  return image;
}

// Quelle place touche ce doigt ? Même découpage d'écran que Top départ.
export function seatAt(count, clientX, clientY, box) {
  if (count === 1) return 0;
  const top = clientY - box.top < box.height / 2;
  const left = clientX - box.left < box.width / 2;
  if (count === 2) return top ? 1 : 0;
  if (count === 3) return top ? 1 : left ? 0 : 2;
  return top ? (left ? 3 : 1) : (left ? 0 : 2);
}

// Petites aides de dessin.
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function text(ctx, value, x, y, { size = 40, color = "#2B2350", weight = 700, align = "center", stroke = null, rotate = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.font = `${weight} ${size}px Fredoka, "Nunito", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = stroke;
    ctx.strokeText(value, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, 0, 0);
  ctx.restore();
}

// Éclaboussures, étincelles : particules qui s'éteignent toutes seules.
export function createParticles() {
  const list = [];
  return {
    burst(x, y, color, { count = 14, speed = 260, size = 8, life = 0.7, gravity = 0 } = {}) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        list.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, size: size * (0.6 + Math.random() * 0.7), color, life, age: 0, gravity });
      }
    },
    update(dt) {
      for (const p of list) {
        p.age += dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-2.5 * dt);
        p.vy *= Math.exp(-2.5 * dt);
      }
      for (let i = list.length - 1; i >= 0; i--) if (list[i].age >= list[i].life) list.splice(i, 1);
    },
    draw(ctx) {
      for (const p of list) {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.age / p.life * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };
}
