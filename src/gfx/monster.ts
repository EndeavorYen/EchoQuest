import { FB, T, type Sprite } from './fb';
import { C, RAMPS, type PalIndex, type RampName } from './palette';
import { Rng } from '../util/rng';

export type Kind = 'blob' | 'bean' | 'ghost' | 'drop' | 'rock';
export type Accessory = 'none' | 'horns' | 'ears' | 'sprout' | 'flame' | 'antenna' | 'crown';
type EyeStyle = 'dot' | 'round';
type MouthStyle = 'smile' | 'cat' | 'tooth' | 'flat';

export interface MonsterSpec {
  seed: number;
  ramp: RampName;
  kind: Kind;
  accessory: Accessory;
  boss: boolean;
}

export type FrameName = 'idle' | 'blink' | 'hurt' | 'open';

export interface Monster {
  spec: MonsterSpec;
  size: number;
  frames: Record<FrameName, Sprite>;
  /** y (inside the sprite) of the lowest body pixel — where the ground shadow goes */
  groundY: number;
  /** centre of the face, handy for aiming effects */
  faceX: number;
  faceY: number;
}

const KINDS: Kind[] = ['blob', 'bean', 'ghost', 'drop', 'rock'];

/** Which accessories make sense for which colour family. */
const ACCESSORIES_BY_RAMP: Record<RampName, Accessory[]> = {
  fire: ['flame', 'horns', 'horns', 'none'],
  berry: ['horns', 'ears', 'antenna', 'none'],
  leaf: ['sprout', 'sprout', 'ears', 'none'],
  water: ['antenna', 'none', 'ears', 'sprout'],
  sky: ['antenna', 'ears', 'none', 'horns'],
  sun: ['antenna', 'ears', 'horns', 'none'],
  ghost: ['none', 'antenna', 'ears', 'none'],
  night: ['horns', 'none', 'ears', 'antenna'],
  plum: ['horns', 'ears', 'antenna', 'none'],
};

export function randomSpec(seed: number, ramp: RampName, boss = false): MonsterSpec {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const kind = ramp === 'ghost' || ramp === 'night' ? rng.pick<Kind>(['ghost', 'ghost', 'blob', 'bean']) : rng.pick(KINDS);
  const accessory = boss ? 'crown' : rng.pick(ACCESSORIES_BY_RAMP[ramp]);
  return { seed, ramp, kind, accessory, boss };
}

// ---------------------------------------------------------------------------
// body silhouette
// ---------------------------------------------------------------------------

interface BodyGeom {
  cx: number;
  top: number;
  bottom: number;
  /** half width at this row, or 0 when outside */
  hw(y: number): number;
  /** ghosts have a scalloped hem: extra bottom cut for column x */
  hem?(x: number): number;
}

function makeBody(kind: Kind, n: number, rng: Rng, accMargin: number): BodyGeom {
  const cx = n / 2;
  const feet = kind === 'ghost' ? 3 : Math.round(n * 0.09);
  const top = accMargin;
  const bottom = n - feet - 1;
  const h = bottom - top;
  const wf = rng.range(0.9, 1.04);

  switch (kind) {
    case 'bean': {
      const R = n * 0.33 * wf;
      const p = 2.3;
      return {
        cx, top, bottom,
        hw: (y) => {
          const t = (y - top) / h;
          if (t < 0 || t > 1) return 0;
          return R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), p)), 1 / p);
        },
      };
    }
    case 'ghost': {
      const R = n * 0.37 * wf;
      const sway = rng.range(0.0, 1.2);
      const waves = rng.pick([3, 3, 4]);
      const amp = Math.max(2, Math.round(n * 0.055));
      return {
        cx, top, bottom,
        hw: (y) => {
          const t = (y - top) / h;
          if (t < 0 || t > 1) return 0;
          if (t < 0.55) {
            const u = (0.55 - t) / 0.55;
            return R * Math.sqrt(Math.max(0, 1 - u * u));
          }
          return R * (1 + 0.04 * Math.sin(t * 9 + sway));
        },
        hem: (x) => {
          const u = (x - (cx - R)) / (2 * R);
          return amp * (0.5 + 0.5 * Math.cos(u * waves * Math.PI * 2));
        },
      };
    }
    case 'drop': {
      const R = n * 0.37 * wf;
      return {
        cx, top, bottom,
        hw: (y) => {
          const t = (y - top) / h;
          if (t < 0 || t > 1) return 0;
          if (t < 0.6) return R * Math.pow(t / 0.6, 0.8);
          const u = (t - 0.6) / 0.4;
          return R * Math.sqrt(Math.max(0, 1 - u * u));
        },
      };
    }
    case 'rock': {
      const R = n * 0.4 * wf;
      const steps = Array.from({ length: 7 }, () => rng.range(0.9, 1));
      return {
        cx, top, bottom,
        hw: (y) => {
          const t = (y - top) / h;
          if (t < 0 || t > 1) return 0;
          const taper = t < 0.18 ? 0.55 + (t / 0.18) * 0.45 : t > 0.92 ? 0.88 : 1;
          const idx = Math.min(steps.length - 1, Math.floor(t * steps.length));
          return R * taper * steps[idx];
        },
      };
    }
    case 'blob':
    default: {
      const R = n * 0.43 * wf;
      const p = rng.range(2.3, 2.8);
      return {
        cx, top, bottom,
        hw: (y) => {
          const t = (y - top) / h;
          if (t < 0 || t > 1) return 0;
          return R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), p)), 1 / p);
        },
      };
    }
  }
}

function buildMask(g: BodyGeom, n: number): Uint8Array {
  const m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    const hw = g.hw(y + 0.5);
    if (hw <= 0) continue;
    for (let x = 0; x < n; x++) {
      if (Math.abs(x + 0.5 - g.cx) <= hw) {
        if (g.hem) {
          const cut = g.hem(x + 0.5);
          if (y + 0.5 > g.bottom - cut) continue;
        }
        m[y * n + x] = 1;
      }
    }
  }
  return m;
}

function blurMask(m: Uint8Array, n: number, r: number): Float32Array {
  const out = new Float32Array(n * n);
  const area = (2 * r + 1) * (2 * r + 1);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < n && yy < n) s += m[yy * n + xx];
        }
      }
      out[y * n + x] = s / area;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// drawing helpers on a transparent canvas
// ---------------------------------------------------------------------------

function canvas(n: number): FB {
  const f = new FB(n, n);
  f.clear(T);
  return f;
}

function tri(fb: FB, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: PalIndex): void {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) fb.set(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// accessories (drawn before the body so the body overlaps their roots)
// ---------------------------------------------------------------------------

function drawAccessoryBack(fb: FB, acc: Accessory, g: BodyGeom, n: number, ramp: readonly number[], rng: Rng): void {
  const R = g.hw(g.top + (g.bottom - g.top) * 0.45);
  const cx = g.cx;
  const topY = g.top;
  switch (acc) {
    case 'horns': {
      const len = n * 0.2;
      const base = n * 0.07;
      for (const s of [-1, 1]) {
        const bx = cx + s * R * 0.55;
        const by = topY + (g.bottom - g.top) * 0.12;
        tri(fb, bx - base, by + 2, bx + base, by + 2, bx + s * base * 1.2, by - len, C.snow);
        tri(fb, bx, by + 2, bx + base, by + 2, bx + s * base * 1.2, by - len, C.mist);
      }
      break;
    }
    case 'ears': {
      const len = n * 0.2;
      const base = n * 0.09;
      for (const s of [-1, 1]) {
        const bx = cx + s * R * 0.58;
        const by = topY + (g.bottom - g.top) * 0.16;
        tri(fb, bx - base, by + 3, bx + base, by + 3, bx + s * base * 0.5, by - len, ramp[1]);
        tri(fb, bx - base * 0.5, by + 3, bx + base * 0.5, by + 3, bx + s * base * 0.35, by - len * 0.55, C.orange);
      }
      break;
    }
    case 'sprout': {
      const stem = Math.max(3, Math.round(n * 0.12));
      fb.rect(cx - 1, topY - stem, 2, stem + 2, C.leaf);
      fb.ellipse(cx - n * 0.07, topY - stem - 1, n * 0.075, n * 0.04, C.lime);
      fb.ellipse(cx + n * 0.07, topY - stem - 3, n * 0.075, n * 0.04, C.leaf);
      fb.ellipse(cx - n * 0.09, topY - stem, n * 0.04, n * 0.018, C.lime);
      break;
    }
    case 'flame': {
      const h = n * 0.26;
      for (const [dx, hh, col] of [[-0.12, 0.7, C.orange], [0.1, 0.85, C.orange], [0, 1, C.sun]] as const) {
        const bx = cx + dx * n;
        tri(fb, bx - n * 0.07, topY + 5, bx + n * 0.07, topY + 5, bx + (rng.range(-0.02, 0.02)) * n, topY - h * hh, col);
      }
      tri(fb, cx - n * 0.035, topY + 5, cx + n * 0.035, topY + 5, cx, topY - h * 0.55, C.snow);
      break;
    }
    case 'antenna': {
      const h = Math.max(4, Math.round(topY - 5));
      const lean = rng.pick([-1, 1]);
      fb.line(cx, topY + 2, cx + lean * 4, topY - h, ramp[2]);
      fb.line(cx + 1, topY + 2, cx + lean * 4 + 1, topY - h, ramp[2]);
      fb.disc(cx + lean * 4, topY - h - 1, Math.max(2, Math.round(n * 0.045)), C.sun);
      fb.set(cx + lean * 4 - 1, topY - h - 2, C.snow);
      break;
    }
    case 'crown': {
      const w = n * 0.34;
      const y0 = topY - n * 0.08;
      fb.rect(cx - w / 2, y0, w, n * 0.07, C.sun);
      for (const dx of [-0.5, 0, 0.5]) {
        tri(fb, cx + dx * w - n * 0.04, y0 + 1, cx + dx * w + n * 0.04, y0 + 1, cx + dx * w, y0 - n * 0.1, C.sun);
      }
      fb.rect(cx - w / 2, y0 + n * 0.045, w, n * 0.025, C.orange);
      fb.set(cx, y0 + 2, C.berry);
      fb.set(cx - Math.round(w / 3), y0 + 2, C.sky);
      fb.set(cx + Math.round(w / 3), y0 + 2, C.sky);
      break;
    }
    case 'none':
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// face
// ---------------------------------------------------------------------------

interface FaceParams {
  eyeStyle: EyeStyle;
  mouth: MouthStyle;
  eyeDx: number;
  eyeY: number;
  eyeRx: number;
  eyeRy: number;
  mouthY: number;
  blush: boolean;
  irisColor: PalIndex;
  cx: number;
}

function drawEye(fb: FB, f: FaceParams, side: -1 | 1, state: FrameName): void {
  const ex = f.cx + side * f.eyeDx;
  const ey = f.eyeY;
  const { eyeRx: rx, eyeRy: ry } = f;
  if (state === 'blink') {
    fb.rect(ex - rx, ey + ry * 0.4, rx * 2, 2, C.ink);
    return;
  }
  if (state === 'hurt') {
    const r = Math.max(2, Math.round(rx * 0.9));
    fb.line(ex - r, ey - r, ex + r, ey + r, C.ink);
    fb.line(ex - r, ey + r, ex + r, ey - r, C.ink);
    fb.line(ex - r, ey - r + 1, ex + r, ey + r + 1, C.ink);
    fb.line(ex - r, ey + r + 1, ex + r, ey - r + 1, C.ink);
    return;
  }
  if (f.eyeStyle === 'dot') {
    fb.ellipse(ex, ey, rx, ry, C.ink);
    fb.ellipse(ex - rx * 0.35, ey - ry * 0.4, Math.max(1.1, rx * 0.38), Math.max(1.3, ry * 0.3), C.snow);
    fb.set(Math.round(ex + rx * 0.45), Math.round(ey + ry * 0.45), C.snow);
  } else {
    fb.ellipse(ex, ey, rx + 1, ry + 1, C.ink);
    fb.ellipse(ex, ey, rx, ry, C.snow);
    const px = ex + side * -0.15 * rx;
    fb.ellipse(px, ey + ry * 0.1, rx * 0.62, ry * 0.68, f.irisColor);
    fb.ellipse(px, ey + ry * 0.12, rx * 0.34, ry * 0.42, C.ink);
    fb.set(Math.round(px - rx * 0.25), Math.round(ey - ry * 0.25), C.snow);
    fb.set(Math.round(px - rx * 0.25) + 1, Math.round(ey - ry * 0.25), C.snow);
  }
}

function drawMouth(fb: FB, f: FaceParams, state: FrameName, n: number): void {
  const cx = f.cx;
  const y = Math.round(f.mouthY);
  const w = Math.max(3, Math.round(n * 0.05));
  if (state === 'open') {
    const rx = Math.max(3, Math.round(n * 0.085));
    const ry = Math.max(3, Math.round(n * 0.075));
    fb.ellipse(cx, y + 1, rx + 1, ry + 1, C.ink);
    fb.ellipse(cx, y + 1, rx, ry, C.ink);
    fb.ellipse(cx, y + ry * 0.55, rx * 0.65, ry * 0.45, C.berry);
    return;
  }
  if (state === 'hurt') {
    fb.ellipse(cx, y + 1, 2.2, 2.6, C.ink);
    return;
  }
  switch (f.mouth) {
    case 'cat': {
      for (const s of [-1, 1]) {
        fb.set(cx + s * 1, y + 1, C.ink);
        fb.set(cx + s * 2, y + 1, C.ink);
        fb.set(cx + s * 3, y, C.ink);
      }
      fb.set(cx, y, C.ink);
      break;
    }
    case 'tooth': {
      for (let i = -w; i <= w; i++) fb.set(cx + i, y + (Math.abs(i) > w - 2 ? 0 : 1), C.ink);
      fb.rect(cx - 1, y + 2, 2, 2, C.snow);
      fb.set(cx - 1, y + 4, C.ink);
      fb.set(cx, y + 4, C.ink);
      break;
    }
    case 'flat': {
      fb.rect(cx - w + 1, y + 1, w * 2 - 2, 1, C.ink);
      break;
    }
    case 'smile':
    default: {
      for (let i = -w; i <= w; i++) fb.set(cx + i, y + (Math.abs(i) > w - 2 ? 0 : 1), C.ink);
      break;
    }
  }
}

function drawBlush(fb: FB, f: FaceParams): void {
  if (!f.blush) return;
  for (const s of [-1, 1]) {
    const bx = f.cx + s * (f.eyeDx + f.eyeRx * 0.9);
    const by = Math.round(f.eyeY + f.eyeRy + 1);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if ((dx + dy) % 2 === 0) fb.set(Math.round(bx) + dx, by + dy, C.orange);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// main generator
// ---------------------------------------------------------------------------

export function generateMonster(spec: MonsterSpec): Monster {
  const n = spec.boss ? 80 : 56;
  const rng = new Rng(spec.seed);
  const ramp = RAMPS[spec.ramp];
  const accMargin = spec.accessory === 'none' ? Math.round(n * 0.06) : Math.round(n * (spec.accessory === 'crown' ? 0.15 : 0.2));
  const g = makeBody(spec.kind, n, rng, accMargin);

  const base = canvas(n);
  drawAccessoryBack(base, spec.accessory, g, n, ramp, rng);

  // ---- feet (behind body)
  if (spec.kind !== 'ghost') {
    const fy = g.bottom - 1;
    const fr = n * 0.07;
    for (const s of [-1, 1]) {
      base.ellipse(g.cx + s * n * 0.17, fy + n * 0.03, fr, n * 0.045, ramp[2]);
    }
  }

  // ---- body with light from the top-left
  const mask = buildMask(g, n);
  const blur = blurMask(mask, n, 3);
  const bodyH = g.bottom - g.top;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!mask[y * n + x]) continue;
      const gx = ((x + 1 < n ? blur[y * n + x + 1] : 0) - (x - 1 >= 0 ? blur[y * n + x - 1] : 0)) / 2;
      const gy = ((y + 1 < n ? blur[(y + 1) * n + x] : 0) - (y - 1 >= 0 ? blur[(y - 1) * n + x] : 0)) / 2;
      const len = Math.hypot(gx, gy);
      let light = 0;
      if (len > 0.001) {
        // outward normal = -gradient; light comes from up-left
        light = ((-gx / len) * -0.55 + (-gy / len) * -0.75) * Math.min(1, len * 7);
      }
      const t = (y - g.top) / bodyH;
      let tone = 1;
      if (light > 0.34) tone = 0;
      else if (light < -0.28) tone = 2;
      // ground shading creeps up the lower body
      if (tone === 1 && t > 0.76) tone = 2;
      else if (tone === 1 && t > 0.66 && ((x + y) & 1) === 0) tone = 2;
      // belly rim light keeps the bottom from going flat
      base.set(x, y, ramp[tone]);
    }
  }

  // ---- belly patch / spots (clipped to the body)
  const belly = rng.chance(0.65);
  if (belly) {
    const by = g.top + bodyH * 0.68;
    const patch = canvas(n);
    patch.ellipse(g.cx, by, n * 0.19, n * 0.15, ramp[0]);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (patch.get(x, y) === ramp[0] && mask[y * n + x]) base.set(x, y, ((x + y) & 1) === 0 || y < by + n * 0.08 ? ramp[0] : ramp[1]);
      }
    }
  } else if (rng.chance(0.7)) {
    for (let i = 0; i < 3; i++) {
      const sx = g.cx + rng.range(-0.22, 0.22) * n;
      const sy = g.top + bodyH * rng.range(0.55, 0.85);
      const rr = n * rng.range(0.03, 0.05);
      for (let y = Math.floor(sy - rr); y <= Math.ceil(sy + rr); y++) {
        for (let x = Math.floor(sx - rr); x <= Math.ceil(sx + rr); x++) {
          if (mask[y * n + x] && (x - sx) ** 2 + (y - sy) ** 2 <= rr * rr) base.set(x, y, ramp[2]);
        }
      }
    }
  }

  // ---- outline around everything drawn so far
  const outlined = base.clone();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (base.px[y * n + x] !== T) continue;
      const near =
        (x > 0 && base.px[y * n + x - 1] !== T) ||
        (x < n - 1 && base.px[y * n + x + 1] !== T) ||
        (y > 0 && base.px[(y - 1) * n + x] !== T) ||
        (y < n - 1 && base.px[(y + 1) * n + x] !== T);
      if (near) outlined.px[y * n + x] = C.ink;
    }
  }

  // ---- face parameters
  const eyeStyle: EyeStyle = rng.chance(0.55) ? 'dot' : 'round';
  const hwEye = g.hw(g.top + bodyH * 0.4);
  const face: FaceParams = {
    eyeStyle,
    mouth: rng.pick<MouthStyle>(['smile', 'smile', 'cat', 'tooth', 'flat']),
    eyeDx: Math.round(Math.min(hwEye * 0.5, n * rng.range(0.15, 0.21))),
    eyeY: Math.round(g.top + bodyH * rng.range(0.36, 0.42)),
    eyeRx: Math.max(2, Math.round(n * (eyeStyle === 'dot' ? rng.range(0.06, 0.075) : rng.range(0.07, 0.085)))),
    eyeRy: Math.max(3, Math.round(n * (eyeStyle === 'dot' ? rng.range(0.08, 0.1) : rng.range(0.085, 0.1)))),
    mouthY: 0,
    blush: rng.chance(0.75),
    irisColor: (ramp[3] as number) === C.ink ? ramp[1] : rng.pick([C.royal, C.leaf, C.berry, C.teal]),
    cx: Math.round(g.cx),
  };
  face.mouthY = face.eyeY + face.eyeRy + Math.max(3, Math.round(n * 0.07));

  const frames = {} as Record<FrameName, Sprite>;
  for (const name of ['idle', 'blink', 'hurt', 'open'] as FrameName[]) {
    const f = outlined.clone();
    drawBlush(f, face);
    drawEye(f, face, -1, name);
    drawEye(f, face, 1, name);
    drawMouth(f, face, name, n);
    frames[name] = { w: n, h: n, px: f.px };
  }

  return {
    spec,
    size: n,
    frames,
    groundY: g.bottom + (spec.kind === 'ghost' ? 0 : Math.round(n * 0.06)),
    faceX: face.cx,
    faceY: face.eyeY,
  };
}
