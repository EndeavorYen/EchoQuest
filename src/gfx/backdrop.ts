import { FB, bayer } from './fb';
import { C, type PalIndex } from './palette';
import { Rng } from '../util/rng';

export type Theme = 'meadow' | 'night' | 'cave' | 'sunset';

/**
 * Vertical gradient as pixel-art colour bands: each band is a solid colour and
 * only the seams between bands are dithered, so it reads as hand-made.
 */
function gradient(fb: FB, y0: number, y1: number, colors: PalIndex[]): void {
  const span = Math.max(1, y1 - y0);
  const bands = colors.length;
  const bandH = span / bands;
  const seam = Math.min(9, bandH * 0.45);
  for (let y = y0; y < y1; y++) {
    const pos = (y - y0) / bandH;
    const i = Math.min(bands - 1, Math.floor(pos));
    const into = (pos - i) * bandH; // px from the top of this band
    let f = 0;
    let top = colors[i];
    let bot = colors[i];
    if (i < bands - 1 && bandH - into < seam) {
      // bottom seam: blend towards the next band
      f = 1 - (bandH - into) / seam;
      bot = colors[i + 1];
    }
    for (let x = 0; x < fb.w; x++) {
      fb.set(x, y, bayer(x, y) < f * 16 ? bot : top);
    }
  }
}

function hills(fb: FB, baseY: number, amp: number, color: PalIndex, rng: Rng, detail = 1): void {
  const p1 = rng.range(0, 6.28);
  const p2 = rng.range(0, 6.28);
  const f1 = rng.range(0.018, 0.03) * detail;
  const f2 = rng.range(0.05, 0.08) * detail;
  for (let x = 0; x < fb.w; x++) {
    const y = Math.round(baseY - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2)));
    fb.rect(x, y, 1, fb.h - y, color);
  }
}

function pine(fb: FB, x: number, baseY: number, h: number, dark: PalIndex, light: PalIndex): void {
  const layers = Math.max(3, Math.round(h / 6));
  const lh = h / layers;
  fb.rect(x - 1, baseY - 3, 2, 4, C.plum);
  for (let i = 0; i < layers; i++) {
    const yTop = baseY - h + i * lh * 0.85;
    const half = 2 + i * (h / layers / 2.2);
    for (let yy = 0; yy < lh + 3; yy++) {
      const w = half * (yy / (lh + 3));
      fb.rect(Math.round(x - w), Math.round(yTop + yy), Math.round(w * 2) + 1, 1, dark);
      if (w > 1) fb.set(Math.round(x - w), Math.round(yTop + yy), light);
    }
  }
}

function cloud(fb: FB, x: number, y: number, s: number, c: PalIndex, shade: PalIndex): void {
  fb.ellipse(x, y, 9 * s, 4 * s, c);
  fb.ellipse(x - 7 * s, y + 1 * s, 6 * s, 3 * s, c);
  fb.ellipse(x + 8 * s, y + 1 * s, 7 * s, 3 * s, c);
  fb.rect(x - 14 * s, y + 3 * s, 28 * s, 2, shade);
}

export function makeBackdrop(w: number, h: number, seed: number, theme: Theme): FB {
  const fb = new FB(w, h);
  const rng = new Rng(seed);
  const horizon = Math.round(h * 0.5);

  if (theme === 'cave') {
    gradient(fb, 0, h, [C.ink, C.dusk, C.slate, C.dusk, C.ink]);
    // stalactites
    for (let i = 0; i < 9; i++) {
      const x = rng.int(0, w);
      const len = rng.int(10, 34);
      const half = rng.int(3, 6);
      for (let yy = 0; yy < len; yy++) {
        const ww = Math.max(0, Math.round(half * Math.pow(1 - yy / len, 0.8)));
        fb.rect(x - ww, yy, ww * 2 + 1, 1, C.ink);
        if (ww > 1) fb.set(x - ww, yy, C.dusk);
      }
    }
    // far crystal glow
    for (let i = 0; i < 6; i++) {
      const x = rng.int(6, w - 6);
      const y = rng.int(horizon - 12, horizon + 20);
      const col = rng.pick([C.sky, C.ice, C.lime]);
      for (let k = 0; k < 6; k++) fb.rect(x - 1 + (k % 2), y - k, 2, 1, col);
      fb.veil(x - 7, y - 9, 16, 16, col, 2);
    }
    // floor
    gradient(fb, horizon + 18, h, [C.dusk, C.ink]);
    for (let i = 0; i < 60; i++) fb.set(rng.int(0, w), rng.int(horizon + 20, h), C.slate);
    return fb;
  }

  const skies: Record<Exclude<Theme, 'cave'>, PalIndex[]> = {
    meadow: [C.royal, C.sky, C.sky, C.ice],
    night: [C.ink, C.navy, C.royal, C.sky],
    sunset: [C.plum, C.berry, C.orange, C.sun],
  };
  const sky = skies[theme];
  gradient(fb, 0, horizon + 6, sky);

  if (theme === 'night') {
    for (let i = 0; i < 46; i++) {
      const x = rng.int(0, w);
      const y = rng.int(0, Math.round(horizon * 0.85));
      fb.set(x, y, rng.chance(0.2) ? C.snow : C.mist);
    }
    fb.disc(Math.round(w * 0.78), Math.round(h * 0.13), 8, C.snow);
    fb.disc(Math.round(w * 0.78) + 3, Math.round(h * 0.13) - 2, 7, C.ice);
    fb.ellipse(Math.round(w * 0.78), Math.round(h * 0.13), 14, 14, C.navy);
    fb.disc(Math.round(w * 0.78), Math.round(h * 0.13), 8, C.snow);
    fb.set(Math.round(w * 0.78) - 3, Math.round(h * 0.13) - 2, C.mist);
    fb.set(Math.round(w * 0.78) + 2, Math.round(h * 0.13) + 3, C.mist);
  } else if (theme === 'sunset') {
    fb.disc(Math.round(w * 0.3), horizon - 6, 14, C.sun);
    fb.veil(0, horizon - 40, w, 40, C.sun, 3);
  } else {
    cloud(fb, Math.round(w * 0.25), Math.round(h * 0.12), 1, C.snow, C.ice);
    cloud(fb, Math.round(w * 0.74), Math.round(h * 0.2), 0.8, C.snow, C.ice);
  }

  const farC = theme === 'night' ? C.navy : theme === 'sunset' ? C.plum : C.royal;
  const midC = theme === 'night' ? C.dusk : theme === 'sunset' ? C.dusk : C.teal;
  const nearC = theme === 'night' ? C.teal : theme === 'sunset' ? C.teal : C.leaf;
  hills(fb, horizon + 2, 12, farC, rng);
  hills(fb, horizon + 12, 9, midC, rng, 1.3);

  // trees on the mid hills
  for (let i = 0; i < 9; i++) {
    const x = rng.int(0, w);
    pine(fb, x, horizon + rng.int(14, 24), rng.int(18, 30), theme === 'meadow' ? C.teal : C.dusk, theme === 'meadow' ? C.leaf : C.slate);
  }

  // ground
  const gy = Math.round(h * 0.6);
  gradient(fb, gy - 6, h, [nearC, nearC, theme === 'meadow' ? C.lime : C.teal, nearC]);
  hills(fb, gy, 3, nearC, rng, 2);
  // perspective bands: wider and brighter towards the viewer
  const light = theme === 'meadow' ? C.lime : C.leaf;
  const dark = theme === 'meadow' ? C.leaf : C.teal;
  for (let y = gy + 4, band = 0; y < h; band++) {
    const bh = 3 + band * 2;
    if (band % 2 === 1) {
      for (let yy = y; yy < Math.min(h, y + bh); yy++) {
        for (let x = 0; x < w; x++) if (bayer(x, yy) < 5) fb.set(x, yy, light);
      }
    } else {
      for (let yy = y; yy < Math.min(h, y + bh); yy++) {
        for (let x = 0; x < w; x++) if (bayer(x, yy) < 3) fb.set(x, yy, dark);
      }
    }
    y += bh;
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, w);
    const y = rng.int(gy + 2, h);
    fb.set(x, y, light);
    fb.set(x, y - 1, light);
  }
  // little flowers / mushrooms
  for (let i = 0; i < 7; i++) {
    const x = rng.int(4, w - 4);
    const y = rng.int(gy + 6, h - 6);
    const col = rng.pick([C.sun, C.berry, C.snow, C.orange]);
    fb.set(x, y, col);
    fb.set(x - 1, y, col);
    fb.set(x + 1, y, col);
    fb.set(x, y - 1, col);
    fb.set(x, y + 1, C.sun);
    fb.set(x, y + 2, C.leaf);
  }
  return fb;
}

/** Vignette: darken corners with ink dither so the action stays in the middle. */
export function vignette(fb: FB, strength = 1): void {
  const cx = fb.w / 2;
  const cy = fb.h / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const lvl = Math.max(0, (d - 0.55) * 22 * strength);
      if (bayer(x, y) < lvl) fb.px[y * fb.w + x] = C.ink;
    }
  }
}
