import type { FB } from './fb';
import { C, type PalIndex } from './palette';

/**
 * Text is rasterised once per character from the bundled pixel font
 * (Fusion Pixel, 12px, OFL) into a 1-bit bitmap and then blitted into the
 * indexed framebuffer — so Chinese and English both stay perfectly crisp.
 */
export interface Glyph {
  /** bitmap width (== advance) */
  w: number;
  h: number;
  bits: Uint8Array;
}

export type GlyphRasterizer = (ch: string) => Glyph;

export const FONT_FAMILY = '"Fusion Pixel 12px Proportional Traditional Chinese"';
export const GLYPH_H = 14;
export const BASELINE = 10;
export const LINE_H = 14;

let rasterizer: GlyphRasterizer | null = null;
const cache = new Map<string, Glyph>();

export function setRasterizer(r: GlyphRasterizer): void {
  rasterizer = r;
  cache.clear();
}

export function clearGlyphCache(): void {
  cache.clear();
}

function glyph(ch: string): Glyph {
  let g = cache.get(ch);
  if (g) return g;
  if (!rasterizer) throw new Error('text rasterizer not set');
  g = rasterizer(ch);
  cache.set(ch, g);
  return g;
}

/**
 * Browser rasterizer built on a 2D canvas. `fontFamily` can be a list of
 * aliases (tests register several font shards under different names).
 */
export function canvasRasterizer(
  makeCanvas: (w: number, h: number) => { getContext(type: '2d', opts?: unknown): any },
  fontFamily: string = FONT_FAMILY,
): GlyphRasterizer {
  const cell = 20;
  const canvas = makeCanvas(cell, GLYPH_H + 4);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return (ch: string): Glyph => {
    ctx.font = `12px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const measured = Math.round(ctx.measureText(ch).width);
    const w = Math.max(1, Math.min(cell, measured || 6));
    ctx.clearRect(0, 0, cell, GLYPH_H + 4);
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, 0, BASELINE);
    const data = ctx.getImageData(0, 0, w, GLYPH_H).data as Uint8ClampedArray;
    const bits = new Uint8Array(w * GLYPH_H);
    for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4 + 3] > 127 ? 1 : 0;
    return { w, h: GLYPH_H, bits };
  };
}

export interface TextOpts {
  scale?: number;
  align?: 'left' | 'center' | 'right';
  /** 1px drop shadow, down-right */
  shadow?: PalIndex;
  /** 1px outline in all four directions (drawn under the text) */
  outline?: PalIndex;
  /** extra pixels between characters */
  tracking?: number;
  /** word-wrap to this many pixels (newlines always break lines) */
  wrapW?: number;
}

export function measure(text: string, scale = 1, tracking = 0): number {
  let w = 0;
  for (const ch of text) {
    w += glyph(ch).w * scale + tracking;
  }
  return Math.max(0, w - tracking);
}

function stamp(fb: FB, g: Glyph, x: number, y: number, c: PalIndex, scale: number): void {
  for (let gy = 0; gy < g.h; gy++) {
    for (let gx = 0; gx < g.w; gx++) {
      if (!g.bits[gy * g.w + gx]) continue;
      if (scale === 1) {
        fb.set(x + gx, y + gy, c);
      } else {
        fb.rect(x + gx * scale, y + gy * scale, scale, scale, c);
      }
    }
  }
}

/** Draw text with its top-left at (x, y). Returns the drawn width. */
export function drawText(fb: FB, text: string, x: number, y: number, color: PalIndex, o: TextOpts = {}): number {
  if (o.wrapW !== undefined || text.includes('\n')) {
    const lines = o.wrapW !== undefined ? wrap(text, o.wrapW, o.scale ?? 1) : text.split('\n');
    const { wrapW: _w, ...rest } = o;
    void _w;
    let widest = 0;
    lines.forEach((ln, i) => {
      widest = Math.max(widest, drawText(fb, ln, x, y + i * LINE_H * (o.scale ?? 1), color, rest));
    });
    return widest;
  }
  const scale = o.scale ?? 1;
  const tracking = o.tracking ?? 0;
  const width = measure(text, scale, tracking);
  let cx = x;
  if (o.align === 'center') cx = Math.round(x - width / 2);
  else if (o.align === 'right') cx = x - width;

  const passes: Array<[number, number, PalIndex]> = [];
  if (o.outline !== undefined) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      passes.push([dx * scale, dy * scale, o.outline]);
    }
  }
  if (o.shadow !== undefined) passes.push([scale, scale, o.shadow]);
  passes.push([0, 0, color]);

  for (const [dx, dy, col] of passes) {
    let px = cx;
    for (const ch of text) {
      const g = glyph(ch);
      if (ch !== ' ') stamp(fb, g, px + dx, y + dy, col, scale);
      px += g.w * scale + tracking;
    }
  }
  return width;
}

const CJK = /[⺀-鿿＀-￯　-〿]/;

/** Word-wrap for mixed English / Chinese text. */
export function wrap(text: string, maxW: number, scale = 1): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    // tokens: a run of non-CJK non-space chars, a single CJK char, or a space
    const tokens = para.match(/[^\s⺀-鿿＀-￯　-〿]+|[⺀-鿿＀-￯　-〿]|\s+/g) ?? [];
    for (const tok of tokens) {
      const trial = line + tok;
      if (measure(trial, scale) <= maxW || line === '') {
        line = trial;
      } else {
        lines.push(line.trimEnd());
        line = /^\s+$/.test(tok) ? '' : tok;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function isCjk(ch: string): boolean {
  return CJK.test(ch);
}

/** Convenience: centered text with the house style (ink outline). */
export function title(fb: FB, text: string, cx: number, y: number, color: PalIndex, scale = 1): void {
  drawText(fb, text, cx, y, color, { align: 'center', scale, outline: C.ink });
}
