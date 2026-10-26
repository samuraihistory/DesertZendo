// Ink drawing for Nhat Hanh November: brushed ensō circles, a seal, the
// paper's fibers and a brushed rule. Everything is drawn on canvas from the
// page's color tokens, so it follows light and dark mode and ships no images.
//
// Canvases opt in with data attributes:
//   <canvas data-enso data-size="96" data-seed="3" data-progress="0.4">
//   <canvas data-seal="息" data-size="30">
// and are redrawn by Ink.redraw(canvas) or Ink.drawAll().

window.Ink = (function () {
  "use strict";

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Small seeded PRNG so each mark looks hand-made but stays the same on
  // every draw.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  function prepare(canvas) {
    const size = Number(canvas.dataset.size) || 100;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    return { ctx, size };
  }

  // A dry-brush ensō: a bundle of bristles swept around a slightly wobbly
  // circle. Each bristle runs out of ink at its own rate, which leaves the
  // streaky, broken tail of a real brush stroke.
  function enso(canvas) {
    const { ctx, size } = prepare(canvas);
    const progress = Math.max(0, Math.min(1, canvas.dataset.progress === undefined ? 1 : Number(canvas.dataset.progress)));
    if (progress <= 0) return;
    const rand = rng(Number(canvas.dataset.seed) || 7);
    const weight = Number(canvas.dataset.weight) || 0.11;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const sweep = Math.PI * 2 * 0.93; // a full ensō leaves a small opening
    const start = Math.PI * 0.62; // begins low on the left, moves clockwise
    const wobblePhase = rand() * Math.PI * 2;

    const bristles = 26;
    const rates = [];
    const offsets = [];
    for (let i = 0; i < bristles; i++) {
      rates.push(0.35 + rand() * 1.25);
      offsets.push(i / (bristles - 1) - 0.5 + (rand() - 0.5) * 0.04);
    }

    ctx.strokeStyle = token("--ink") || "#1e1c19";
    ctx.lineCap = "round";
    const steps = Math.max(40, Math.round(260 * progress));
    const last = new Array(bristles).fill(null);

    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * progress;
      const angle = start + t * sweep;
      // Heavy where the brush lands, thinning as it lifts.
      const press = t < 0.06 ? 0.75 + t * 5 : 1.05 - 0.55 * Math.pow(t, 1.6);
      const width = size * weight * press;
      const r = radius * (1 + 0.025 * Math.sin(angle * 2 + wobblePhase) + 0.012 * Math.sin(angle * 5));
      for (let i = 0; i < bristles; i++) {
        const rr = r + offsets[i] * width;
        const x = cx + Math.cos(angle) * rr;
        const y = cy + Math.sin(angle) * rr;
        const ink = 1 - t * rates[i];
        if (last[i] && ink > rand() * 0.45) {
          ctx.globalAlpha = Math.min(0.9, 0.35 + ink * 0.6);
          ctx.lineWidth = (width / bristles) * 2.1;
          ctx.beginPath();
          ctx.moveTo(last[i][0], last[i][1]);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        last[i] = [x, y];
      }
    }
    ctx.globalAlpha = 1;
  }

  // A carved seal: vermilion block with the character cut out of it and a
  // few worn specks, as if pressed by hand.
  function seal(canvas) {
    const { ctx, size } = prepare(canvas);
    const rand = rng(size * 31 + 5);
    ctx.fillStyle = token("--seal") || "#b23a2a";
    const inset = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(inset + rand() * 1.5, inset);
    ctx.lineTo(size - inset, inset + rand() * 1.5);
    ctx.lineTo(size - inset - rand() * 1.5, size - inset);
    ctx.lineTo(inset, size - inset - rand() * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.font = `${Math.round(size * 0.72)}px "Yuji Syuku", "Shippori Mincho", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(canvas.dataset.seal, size / 2, size / 2 + size * 0.04);
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, rand() * size * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // Long, faint fibers like those in handmade paper, as a repeating tile.
  function paperTexture() {
    const size = 420;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const rand = rng(1126);
    ctx.strokeStyle = token("--fiber");
    ctx.lineCap = "round";
    for (let i = 0; i < 46; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 20 + rand() * 70;
      const a = rand() * Math.PI * 2;
      ctx.globalAlpha = 0.15 + rand() * 0.3;
      ctx.lineWidth = 0.3 + rand() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a + 0.2) * len * 0.5,
        y + Math.sin(a + 0.2) * len * 0.5,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len
      );
      ctx.stroke();
    }
    return c.toDataURL();
  }

  // A single horizontal brush stroke: bristles that swell from the tip,
  // then run dry one by one toward the end.
  function brushRule() {
    const w = 600;
    const h = 16;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const rand = rng(42);
    ctx.strokeStyle = token("--ink-faint");
    ctx.lineCap = "round";
    const bristles = 14;
    for (let i = 0; i < bristles; i++) {
      const offset = i / (bristles - 1) - 0.5;
      const dryAt = 0.55 + rand() * 0.45; // where this bristle runs out
      ctx.globalAlpha = 0.55 + rand() * 0.35;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      let drawing = false;
      for (let x = 4; x < w - 4; x += 3) {
        const t = x / w;
        const thick = h * 0.8 * Math.min(1, t * 9) * (1 - 0.6 * t);
        const y = h / 2 + offset * thick + Math.sin(t * 5 + i) * 0.4;
        const inked = t < dryAt || rand() < 0.25;
        if (inked && !drawing) {
          ctx.moveTo(x, y);
          drawing = true;
        } else if (inked) {
          ctx.lineTo(x, y);
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
    }
    return c.toDataURL();
  }

  function redraw(canvas) {
    if ("enso" in canvas.dataset) enso(canvas);
    else if ("seal" in canvas.dataset) seal(canvas);
  }

  function drawAll() {
    const root = document.documentElement;
    root.style.setProperty("--paper-texture", `url(${paperTexture()})`);
    root.style.setProperty("--brush-rule", `url(${brushRule()})`);
    document.querySelectorAll("canvas[data-enso], canvas[data-seal]").forEach(redraw);
  }

  // Colors come from tokens, so redraw whenever the theme changes.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawAll);
  new MutationObserver(drawAll).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  if (document.fonts) document.fonts.ready.then(drawAll);
  drawAll();

  return { redraw, drawAll };
})();
