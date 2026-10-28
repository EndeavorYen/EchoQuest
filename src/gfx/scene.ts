import { FB } from './fb';
import { bayer } from './fb';
import { nearestLut, type RampName } from './palette';
import { Rng } from '../util/rng';

/**
 * Turning a real-world photo into (a) a dithered 16-colour backdrop and
 * (b) a handful of numbers that decide what kind of monster lives there.
 */

export interface SceneAnalysis {
  /** 0..1 */
  brightness: number;
  /** 0..1 average saturation */
  saturation: number;
  /** 0..1 how busy / edgy the picture is */
  detail: number;
  /** weight per colour family, summing to ~1 */
  weights: Record<RampName, number>;
  /** a number derived from the pixels, so the same scene tends to hash the same */
  hash: number;
}

export interface QuantizeOpts {
  contrast?: number;
  saturation?: number;
  /** dither strength in 0..255 colour units */
  dither?: number;
}

/**
 * RGBA (already scaled to w×h) → indexed framebuffer, with ordered dithering.
 * Contrast and saturation are pushed a little so that dull indoor photos still
 * read well inside a 16-colour palette.
 */
export function quantizeRGBA(rgba: ArrayLike<number>, w: number, h: number, o: QuantizeOpts = {}): FB {
  const contrast = o.contrast ?? 1.25;
  const sat = o.saturation ?? 1.35;
  const dith = o.dither ?? 26;
  const lut = nearestLut();
  const fb = new FB(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = rgba[i];
      let g = rgba[i + 1];
      let b = rgba[i + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
      const d = (bayer(x, y) / 15 - 0.5) * dith;
      r = Math.max(0, Math.min(255, r + d));
      g = Math.max(0, Math.min(255, g + d));
      b = Math.max(0, Math.min(255, b + d));
      fb.px[y * w + x] = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
    }
  }
  return fb;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hueToRamp(h: number): RampName {
  if (h < 15 || h >= 345) return 'berry';
  if (h < 42) return 'fire';
  if (h < 70) return 'sun';
  if (h < 170) return 'leaf';
  if (h < 200) return 'water';
  if (h < 255) return 'sky';
  return 'plum';
}

export function analyzeScene(rgba: ArrayLike<number>, w: number, h: number): SceneAnalysis {
  const weights: Record<RampName, number> = {
    fire: 0, berry: 0, leaf: 0, water: 0, sky: 0, sun: 0, ghost: 0, night: 0, plum: 0,
  };
  let sumV = 0;
  let sumS = 0;
  let edge = 0;
  let hash = 2166136261;
  const n = w * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [hh, s, v] = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
      sumV += v;
      sumS += s;
      // chromatic pixels vote for their hue; grey ones vote for ghost / night
      const chroma = s * v;
      if (chroma > 0.12) weights[hueToRamp(hh)] += chroma;
      else if (v > 0.55) weights.ghost += 0.25 + v * 0.2;
      else weights.night += 0.25 + (1 - v) * 0.2;
      if (x > 0) {
        const j = i - 4;
        edge += Math.abs(rgba[i] - rgba[j]) + Math.abs(rgba[i + 1] - rgba[j + 1]) + Math.abs(rgba[i + 2] - rgba[j + 2]);
      }
      if (((x + y * 3) & 7) === 0) {
        hash ^= (rgba[i] >> 4) | ((rgba[i + 1] >> 4) << 4) | ((rgba[i + 2] >> 4) << 8);
        hash = Math.imul(hash, 16777619);
      }
    }
  }
  const brightness = sumV / n;
  // dark rooms get ghosts and night creatures, no matter what colour is left in them
  if (brightness < 0.3) {
    weights.night += (0.3 - brightness) * n * 1.2;
    weights.ghost += (0.3 - brightness) * n * 0.6;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  (Object.keys(weights) as RampName[]).forEach((k) => { weights[k] /= total; });
  return {
    brightness,
    saturation: sumS / n,
    detail: Math.min(1, edge / (n * 3 * 40)),
    weights,
    hash: hash >>> 0,
  };
}

/**
 * Pick a colour family. The strongest colours in the room usually win, but a
 * dash of randomness keeps a mostly-wooden living room from spawning the same
 * orange monster forever.
 */
export function pickRamp(a: SceneAnalysis, rng: Rng): RampName {
  const entries = (Object.entries(a.weights) as Array<[RampName, number]>).sort((x, y) => y[1] - x[1]);
  const roll = rng.next();
  if (roll < 0.5) return entries[0][0];
  if (roll < 0.78 && entries[1]) return entries[1][0];
  if (roll < 0.9 && entries[2]) return entries[2][0];
  return rng.pick(['fire', 'berry', 'leaf', 'water', 'sky', 'sun', 'plum', 'ghost'] as RampName[]);
}
