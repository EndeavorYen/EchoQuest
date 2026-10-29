/**
 * Photo colours → a creature. A port of colormon's matching (white balance,
 * subject detection, CIELAB k-means, two-way colour distance, type affinity,
 * rarity weights). Pure functions: the caller hands over a small square of RGBA.
 */
import config from '../data/mon/config.json';
import { DEX, TYPES, type Mon } from './dex';
import { Rng } from '../util/rng';

type Lab = [number, number, number];
type RGB = [number, number, number];

const CFG = config as unknown as {
  color: { whiteBalance: Record<string, number | boolean>; vividWeight: number; lightnessWeight: number };
  subject: { enabled: boolean; threshold: number; minFraction: number; maxFraction: number; weight: number; bgMinShare?: number };
  night: { darkL: number; colorFactor: number; types: string[]; ids: number[]; rarityScale: Record<string, number>; candidates?: number };
  rarityWeight: Record<string, number>;
  rarityCap: Record<string, number>;
  typeWeight: number; colorOnlyChance: number; typeWindow: number; typeTemp: number; maxTypes: number;
  candidates: number; minCandidates: number; widenFactor: number; randomness: number; similarityWindow: number; caughtWeight: number;
};

// ---- colour maths -----------------------------------------------------------

let lin: number[] | null = null;
const linTable = (): number[] =>
  lin ?? (lin = Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }));

export function rgbLab(r: number, g: number, b: number): Lab {
  const L = linTable();
  const R = L[r], G = L[g], B = L[b];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x) - fy), 200 * (fy - f(z))];
}

export function hexLab(h: string): Lab {
  const n = parseInt(h.slice(1), 16);
  return rgbLab(n >> 16, (n >> 8) & 255, n & 255);
}

const dE = (p: Lab, q: Lab): number => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
/** Lightness counts for less, so a lit side and a shadow side are the same colour. */
const dW = (p: Lab, q: Lab): number => Math.hypot((p[0] - q[0]) * CFG.color.lightnessWeight, p[1] - q[1], p[2] - q[2]);
const chromaOf = (l: Lab): number => Math.hypot(l[1], l[2]);

function labRgb(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const R = x * 3.2406 - y * 1.5372 - z * 0.4986, G = -x * 0.9689 + y * 1.8758 + z * 0.0415, B = x * 0.0557 - y * 0.204 + z * 1.057;
  const g = (c: number) => Math.max(0, Math.min(255, Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255)));
  return [g(R), g(G), g(B)];
}

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

/** English colour word (spoken to toddlers) and a Chinese label. */
const HUE: Array<[number, string, string]> = [
  [15, 'red', '紅'], [40, 'orange', '橘'], [68, 'yellow', '黃'], [95, 'green', '黃綠'], [160, 'green', '綠'],
  [195, 'blue', '水藍'], [250, 'blue', '藍'], [290, 'purple', '紫'], [345, 'pink', '粉紅'], [361, 'red', '紅'],
];

export function colorWord([r, g, b]: RGB): { en: string; zh: string } {
  const [h, s, v] = rgb2hsv(r, g, b);
  const [L, a, bb] = rgbLab(r | 0, g | 0, b | 0);
  const ch = Math.hypot(a, bb);
  if (v < 0.2) return { en: 'black', zh: '黑色' };
  if (ch < 10 && L >= 80) return { en: 'white', zh: '白色' };
  if (s < 0.15 || ch < 8) return L >= 80 ? { en: 'white', zh: '白色' } : L < 40 ? { en: 'gray', zh: '深灰色' } : { en: 'gray', zh: '灰色' };
  if (h >= 15 && h < 50 && v < 0.62) return { en: 'brown', zh: '咖啡色' };
  if (h >= 18 && h < 50 && s >= 0.15 && s < 0.6 && v < 0.88) return { en: 'brown', zh: '淺咖啡色' };
  const hue = HUE.find(([l]) => h < l)!;
  return { en: hue[1], zh: (v < 0.42 ? '深' : s < 0.42 && v > 0.72 ? '淺' : '') + hue[2] + '色' };
}

// ---- photo → palette ----------------------------------------------------------

export interface Swatch { lab: Lab; rgb: RGB; share: number; word: { en: string; zh: string }; subject?: boolean }
export interface Analysis { pal: Swatch[]; mask: Uint8Array | null; N: number }

interface Pt { lab: Lab; rgb: RGB; w: number; i: number; s?: boolean }

interface WB { luts: Uint8ClampedArray[] }

function whiteBalance(px: ArrayLike<number>, n: number): WB | null {
  const c = CFG.color.whiteBalance as Record<string, number | boolean>;
  const num = (k: string, d: number): number => (typeof c[k] === 'number' ? (c[k] as number) : d);
  if (c.enabled === false) return null;
  const L = linTable();
  const cand: number[][] = [];
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (Math.max(r, g, b) >= 250) continue;
    const lab = rgbLab(r, g, b), ch = chromaOf(lab);
    if (lab[0] < num('minL', 62) || ch > num('maxChroma', 42)) continue;
    if (ch > 8) {
      const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
      const dYel = Math.abs(((h - 75 + 540) % 360) - 180), dBlue = Math.abs(((h - 255 + 540) % 360) - 180);
      if (Math.min(dYel, dBlue) > num('hueTolerance', 35)) continue;
    }
    cand.push([L[r], L[g], L[b], lab[0]]);
  }
  if (cand.length < n * num('minFraction', 0.04)) return null;
  cand.sort((a, b) => b[3] - a[3]);
  const top = cand.slice(0, Math.max(8, Math.floor(cand.length / 2)));
  const avg = [0, 1, 2].map((k) => top.reduce((a, p) => a + p[k], 0) / top.length);
  const ref = Math.max(...avg);
  const coverage = cand.length / n;
  const refL = top.reduce((a, p) => a + p[3], 0) / top.length;
  const lo = num('refLowL', 64), hi = num('refHighL', 80);
  const bright = Math.max(0, Math.min(1, (refL - lo) / (hi - lo)));
  const s = num('strength', 0.7) * bright * (coverage > num('uniformCoverage', 0.93) ? num('uniformFactor', 0.15) : 1);
  if (s < 0.05) return null;
  const gains = avg.map((v) => Math.max(0.6, Math.min(num('maxGain', 2.2), 1 + (ref / v - 1) * s)));
  const gm = (v: number) => Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
  const luts = gains.map((k) => {
    const t = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) t[v] = gm(Math.min(1, L[v] * k));
    return t;
  });
  return { luts };
}

function repColor(pts: Pt[]): { lab: Lab; rgb: RGB } {
  const Ls = pts.map((p) => p.lab[0]).sort((a, b) => a - b);
  const lo = Ls[Math.floor(Ls.length * 0.2)], hi = Ls[Math.min(Ls.length - 1, Math.floor(Ls.length * 0.9))];
  let core = pts.filter((p) => p.lab[0] >= lo && p.lab[0] <= hi);
  if (core.length < 3) core = pts;
  const ch = core.map((p) => chromaOf(p.lab)).sort((a, b) => a - b);
  const cmed = ch[ch.length >> 1];
  let viv = core.filter((p) => chromaOf(p.lab) >= cmed);
  if (viv.length < 3) viv = core;
  const med = (k: number) => viv.map((p) => p.lab[k]).sort((a, b) => a - b)[viv.length >> 1];
  const lab: Lab = [med(0), med(1), med(2)];
  return { lab, rgb: labRgb(...lab) };
}

interface Group { w: number; lab: Lab; pts: Pt[] }

function kmeansLab(P: Pt[], K: number): Swatch[] {
  if (!P.length) return [];
  const W = P.reduce((a, p) => a + p.w, 0);
  let C: Lab[] = [[0, 1, 2].map((k) => P.reduce((a, p) => a + p.lab[k] * p.w, 0) / W) as Lab];
  while (C.length < K) {
    let best: Pt | null = null, bd = -1;
    for (const p of P) {
      const d = Math.min(...C.map((c) => dW(c, p.lab))) * p.w;
      if (d > bd) { bd = d; best = p; }
    }
    if (!best || bd <= 0) break;
    C.push([...best.lab] as Lab);
  }
  let groups: Group[] = [];
  for (let it = 0; it < 10; it++) {
    groups = C.map(() => ({ w: 0, lab: [0, 0, 0] as Lab, pts: [] as Pt[] }));
    for (const p of P) {
      let bi = 0, bd = 1e9;
      C.forEach((c, i) => { const d = dW(c, p.lab); if (d < bd) { bd = d; bi = i; } });
      const g = groups[bi];
      g.w += p.w; g.pts.push(p);
      for (let k = 0; k < 3; k++) g.lab[k] += p.lab[k] * p.w;
    }
    groups = groups.filter((g) => g.w > 0);
    groups.forEach((g) => { for (let k = 0; k < 3; k++) g.lab[k] /= g.w; });
    C = groups.map((g) => g.lab);
  }
  groups.sort((a, b) => b.w - a.w);
  const merged: Group[] = [];
  for (const g of groups) {
    const m = merged.find((o) => dW(o.lab, g.lab) < 10);
    if (m) { m.w += g.w; m.pts.push(...g.pts); } else merged.push({ ...g, pts: g.pts.slice() });
  }
  return merged.map((g) => {
    const r = repColor(g.pts);
    return { lab: r.lab, rgb: r.rgb, share: g.w / W, word: colorWord(r.rgb) };
  });
}

/** `px` is RGBA for an N×N square (already cropped and shrunk by the caller). */
export function analyzeColors(px: ArrayLike<number>, N: number): Analysis {
  const n = N * N;
  const wb = whiteBalance(px, n);
  const vw = CFG.color.vividWeight;
  const P: Pt[] = [], border: Pt[] = [];
  const edge = Math.round(N * 0.12);
  for (let i = 0; i < n; i++) {
    const x = i % N, y = (i / N) | 0;
    const dist = Math.hypot(x - (N - 1) / 2, y - (N - 1) / 2) / (N * 0.7);
    let r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (wb) { r = wb.luts[0][r]; g = wb.luts[1][g]; b = wb.luts[2][b]; }
    const lab = rgbLab(r, g, b);
    const p: Pt = { lab, rgb: [r, g, b], w: (1 + 2 * Math.max(0, 1 - dist)) * (1 + vw * Math.min(1, chromaOf(lab) / 60)), i };
    P.push(p);
    if (x < edge || x >= N - edge || y < edge || y >= N - edge) border.push({ ...p, w: 1 });
  }
  const sc = CFG.subject;
  const full = kmeansLab(P, 5).filter((g, i) => i === 0 || g.share >= 0.04);
  if (sc.enabled === false) return { pal: full, mask: null, N };
  const bg = kmeansLab(border, 5).filter((g) => g.share >= (sc.bgMinShare ?? 0.03));
  for (const p of P) p.s = Math.min(...bg.map((c) => dW(c.lab, p.lab))) > sc.threshold;
  const subj = P.filter((p) => p.s);
  const W = P.reduce((a, p) => a + p.w, 0), sw = subj.reduce((a, p) => a + p.w, 0), frac = sw / W;
  if (frac < sc.minFraction || frac > sc.maxFraction || !bg.length) return { pal: full, mask: null, N };
  const weight = sc.weight;
  const sp = kmeansLab(subj, 3).filter((g, i) => i === 0 || g.share >= 0.08).map((g) => ({ ...g, share: g.share * weight, subject: true }));
  const bp = kmeansLab(P.filter((p) => !p.s), 3).filter((g, i) => i === 0 || g.share >= 0.08).map((g) => ({ ...g, share: g.share * (1 - weight) }));
  const mask = new Uint8Array(n);
  for (const p of subj) mask[p.i] = 1;
  return { pal: [...sp, ...bp], mask, N };
}

// ---- palette → creature -------------------------------------------------------

const labCache = new Map<number, Lab[]>();
const labsOf = (m: Mon): Lab[] => {
  let l = labCache.get(m.id);
  if (!l) labCache.set(m.id, (l = m.colors.map(hexLab)));
  return l;
};
const affCache = new Map<string, Lab[]>();
const affOf = (k: string): Lab[] | null => {
  const t = TYPES[k];
  if (!t?.affinity) return null;
  let l = affCache.get(k);
  if (!l) affCache.set(k, (l = t.affinity.map(hexLab)));
  return l;
};

/** Two-way match: the photo's colours must be found on the creature and the creature's on the photo. Lower is closer. */
export function scoreMon(pal: Swatch[], mon: Mon): number {
  const labs = labsOf(mon);
  const top = pal.slice(0, 3);
  const tot = top.reduce((a, c) => a + c.share, 0);
  let photoToMon = 0;
  for (const c of top) photoToMon += (c.share / tot) * Math.min(...labs.map((l) => dE(c.lab, l)));
  const mw = labs.map((_, j) => (j === 0 ? 0.7 : 0.3 / (labs.length - 1 || 1)));
  let monToPhoto = 0;
  labs.forEach((l, j) => { monToPhoto += mw[j] * Math.min(...top.map((c) => dE(c.lab, l))); });
  return 0.5 * photoToMon + 0.5 * monToPhoto + 0.25 * dE(pal[0].lab, labs[0]);
}

function typeDistances(pal: Swatch[]): Record<string, number> {
  const top = pal.slice(0, 3);
  const tot = top.reduce((a, c) => a + c.share, 0);
  const out: Record<string, number> = {};
  for (const k of Object.keys(TYPES)) {
    const aff = affOf(k);
    if (!aff) continue;
    let d = 0;
    for (const c of top) d += (c.share / tot) * Math.min(...aff.map((l) => dE(c.lab, l)));
    out[k] = d;
  }
  return out;
}

interface Scored { m: Mon; d: number }
interface PickOpts { cands?: number; noVivid?: boolean; scale?: Record<string, number> }

function pickFrom(scored: Scored[], pal: Swatch[], r: number, owned: Set<number>, opt: PickOpts = {}): Scored {
  const dmin = scored[0].d;
  const win = CFG.similarityWindow;
  let cands = scored.filter((c) => c.d <= dmin + win).slice(0, opt.cands ?? CFG.candidates);
  if (cands.length < CFG.minCandidates) cands = scored.slice(0, CFG.minCandidates);
  if (cands.filter((c) => !owned.has(c.m.id)).length < 2) {
    const extra = scored.filter((c) => !owned.has(c.m.id) && !cands.includes(c) && c.d <= dmin + win * CFG.widenFactor).slice(0, 6);
    cands = [...cands, ...extra];
  }
  const p0 = pal[0].lab;
  const vivid = Math.min(1, Math.hypot(p0[1], p0[2]) / 70);
  const rar = (k: number) => (CFG.rarityWeight[String(k)] ?? 1) * (k >= 3 && !opt.noVivid ? 1 + vivid * 0.8 : 1) * (opt.scale?.[String(k)] ?? 1);
  const ws = cands.map((c) => Math.exp(-(c.d - dmin) / CFG.randomness) * rar(c.m.rarity) * (owned.has(c.m.id) ? CFG.caughtWeight : 1));
  for (const k of [5, 4]) {
    const cap = CFG.rarityCap[String(k)];
    if (cap == null) continue;
    const idx: number[] = [];
    cands.forEach((c, i) => { if (c.m.rarity === k) idx.push(i); });
    const sk = idx.reduce((q, i) => q + ws[i], 0), all = ws.reduce((q, v) => q + v, 0), rest = all - sk;
    if (sk > 0 && rest > 0 && sk / all > cap) {
      const f = (cap * rest) / ((1 - cap) * sk);
      idx.forEach((i) => { ws[i] *= f; });
    }
  }
  const tot = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < cands.length; i++) {
    acc += ws[i] / tot;
    if (r < acc) return cands[i];
  }
  return cands[0];
}

export const photoBrightness = (pal: Swatch[]): number =>
  pal.reduce((a, c) => a + c.share * c.lab[0], 0) / pal.reduce((a, c) => a + c.share, 0);
export const isNight = (pal: Swatch[]): boolean => photoBrightness(pal) < CFG.night.darkL;

export interface Pick { mon: Mon; night: boolean; /** how alike the colours are, 5–99 */ sim: number }

export interface PickOptions {
  owned?: Set<number>;
  /** only creatures with at least / at most this many stars (boss stops want rare ones) */
  minRarity?: number;
  maxRarity?: number;
}

export function pickMon(pal: Swatch[], rng: Rng, o: PickOptions = {}): Pick {
  const owned = o.owned ?? new Set<number>();
  const MONS = DEX.filter((m) => m.rarity >= (o.minRarity ?? 1) && m.rarity <= (o.maxRarity ?? 5));
  const simOf = (d: number) => Math.max(5, Math.min(99, Math.round(100 - d * 1.3)));
  if (isNight(pal)) {
    const n = CFG.night;
    const ids = new Set(n.ids), types = new Set(n.types);
    let pool = MONS.filter((m) => ids.has(m.id) || types.has(m.type));
    if (!pool.length) pool = MONS;
    const scored = pool.map((m) => ({ m, d: scoreMon(pal, m) * n.colorFactor })).sort((a, b) => a.d - b.d);
    const p = pickFrom(scored, pal, rng.next(), owned, { cands: n.candidates ?? scored.length, noVivid: true, scale: n.rarityScale });
    return { mon: p.m, night: true, sim: simOf(scoreMon(pal, p.m)) };
  }
  const lam = CFG.typeWeight;
  const td = typeDistances(pal);
  const all = MONS.map((m) => { const c = scoreMon(pal, m); return { m, c, d: (1 - lam) * c + lam * (td[m.type] ?? c) }; });
  let pick: Scored;
  if (rng.next() < CFG.colorOnlyChance) {
    pick = pickFrom(all.map((x) => ({ m: x.m, d: x.c })).sort((a, b) => a.d - b.d), pal, rng.next(), owned);
  } else {
    const ts = Object.entries(td).sort((a, b) => a[1] - b[1]);
    const tmin = ts[0][1];
    const tc = ts.filter(([, d]) => d <= tmin + CFG.typeWindow).slice(0, CFG.maxTypes);
    const tw = tc.map(([, d]) => Math.exp(-(d - tmin) / CFG.typeTemp));
    let r = rng.next() * tw.reduce((a, b) => a + b, 0);
    let type = tc[0][0];
    for (let i = 0; i < tc.length; i++) { r -= tw[i]; if (r <= 0) { type = tc[i][0]; break; } }
    const inType = all.filter((x) => x.m.type === type).sort((a, b) => a.d - b.d);
    pick = pickFrom(inType.length ? inType : [...all].sort((a, b) => a.d - b.d), pal, rng.next(), owned);
  }
  return { mon: pick.m, night: false, sim: simOf(scoreMon(pal, pick.m)) };
}

/** Convenience for the camera screen: a flat-colour test image, handy in tests. */
export function solidPixels(rgb: RGB, N = 24): Uint8ClampedArray {
  const px = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) { px[i * 4] = rgb[0]; px[i * 4 + 1] = rgb[1]; px[i * 4 + 2] = rgb[2]; px[i * 4 + 3] = 255; }
  return px;
}
