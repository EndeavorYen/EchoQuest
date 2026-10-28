import { C, RGB, type PalIndex } from './palette';

/** Palette index meaning "transparent" inside sprites. */
export const T = 255;

export interface Sprite {
  w: number;
  h: number;
  /** palette indices, T = transparent */
  px: Uint8Array;
}

export function makeSprite(w: number, h: number): Sprite {
  return { w, h, px: new Uint8Array(w * h).fill(T) };
}

/** 4×4 Bayer matrix, values 0..15 */
const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

export function bayer(x: number, y: number): number {
  return BAYER4[((y & 3) << 2) | (x & 3)];
}

export interface BlitOpts {
  flipX?: boolean;
  scale?: number;
  /** replace every opaque pixel with this colour (flash / silhouette) */
  tint?: PalIndex;
  /** 0..16 — ordered-dither fade, 16 = fully visible */
  alpha?: number;
}

/**
 * Indexed-colour framebuffer. Every pixel is a palette index, so nothing can
 * ever drift off-palette and there is no anti-aliasing to blur the look.
 */
export class FB {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }

  clear(c: PalIndex = C.ink): void {
    this.px.fill(c);
  }

  set(x: number, y: number, c: PalIndex): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  get(x: number, y: number): PalIndex {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: PalIndex): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      this.px.fill(c, yy * this.w + x0, yy * this.w + x1);
    }
  }

  /** 1px outline rectangle */
  frame(x: number, y: number, w: number, h: number, c: PalIndex): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  hline(x: number, y: number, w: number, c: PalIndex): void {
    this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: PalIndex): void {
    this.rect(x, y, 1, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: PalIndex): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(cx: number, cy: number, r: number, c: PalIndex): void {
    const r2 = r * r + r * 0.6;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r2) this.set(cx + x, cy + y, c);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: PalIndex): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  ring(cx: number, cy: number, r: number, c: PalIndex): void {
    const outer = r * r + r * 0.6;
    const inner = (r - 1) * (r - 1) + (r - 1) * 0.6;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d <= outer && d > inner) this.set(cx + x, cy + y, c);
      }
    }
  }

  /** Ordered-dither blend between two colours. level 0 = all a, 16 = all b. */
  dither(x: number, y: number, w: number, h: number, a: PalIndex, b: PalIndex, level: number): void {
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        this.px[yy * this.w + xx] = bayer(xx, yy) < level ? b : a;
      }
    }
  }

  /** Dither a colour over what is already there — a cheap pixel-art "transparency". */
  veil(x: number, y: number, w: number, h: number, c: PalIndex, level: number): void {
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        if (bayer(xx, yy) < level) this.px[yy * this.w + xx] = c;
      }
    }
  }

  /** Map every pixel in a region through a lookup (palette swaps, darken, etc.). */
  remap(x: number, y: number, w: number, h: number, map: ArrayLike<number>): void {
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        const i = yy * this.w + xx;
        this.px[i] = map[this.px[i]];
      }
    }
  }

  blit(s: Sprite, x: number, y: number, o: BlitOpts = {}): void {
    const sc = o.scale ?? 1;
    const alpha = o.alpha ?? 16;
    for (let sy = 0; sy < s.h; sy++) {
      for (let sx = 0; sx < s.w; sx++) {
        const sxr = o.flipX ? s.w - 1 - sx : sx;
        let c = s.px[sy * s.w + sxr];
        if (c === T) continue;
        if (o.tint !== undefined) c = o.tint;
        for (let oy = 0; oy < sc; oy++) {
          for (let ox = 0; ox < sc; ox++) {
            const dx = x + sx * sc + ox;
            const dy = y + sy * sc + oy;
            if (alpha < 16 && bayer(dx, dy) >= alpha) continue;
            this.set(dx, dy, c);
          }
        }
      }
    }
  }

  /** Nearest-neighbour stretch to an arbitrary size — squash & stretch for sprites. */
  blitStretch(s: Sprite, x: number, y: number, w: number, h: number, o: BlitOpts = {}): void {
    const alpha = o.alpha ?? 16;
    for (let dy = 0; dy < h; dy++) {
      const sy = Math.min(s.h - 1, Math.floor((dy * s.h) / h));
      for (let dx = 0; dx < w; dx++) {
        const sx0 = Math.min(s.w - 1, Math.floor((dx * s.w) / w));
        const sx = o.flipX ? s.w - 1 - sx0 : sx0;
        let c = s.px[sy * s.w + sx];
        if (c === T) continue;
        if (o.tint !== undefined) c = o.tint;
        if (alpha < 16 && bayer(x + dx, y + dy) >= alpha) continue;
        this.set(x + dx, y + dy, c);
      }
    }
  }

  /** copy another framebuffer (same or smaller) at an offset */
  copyFrom(src: FB, dx = 0, dy = 0): void {
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        this.px[ty * this.w + tx] = src.px[y * src.w + x];
      }
    }
  }

  clone(): FB {
    const f = new FB(this.w, this.h);
    f.px.set(this.px);
    return f;
  }

  /** Write RGBA into an ImageData-style buffer. */
  toRGBA(out: Uint8ClampedArray | Uint8Array): void {
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) {
      const rgb = RGB[this.px[i]] ?? RGB[0];
      const o = i * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
  }
}
