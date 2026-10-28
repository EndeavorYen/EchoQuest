import type { FB } from './fb';
import { C, HEX, type PalIndex } from './palette';

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

export const FONT_FAMILY = '"EQ Pixel"';
/** Reading text (words, Chinese, instructions) uses a smooth system font; the pixel font is for display text. */
export const CRISP_STACK =
  '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","Heiti TC","Hiragino Sans GB",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const CRISP_SIZE = 12;
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

interface TextCmd {
  text: string;
  x: number;
  y: number;
  color: PalIndex;
  size: number;
  outline?: PalIndex;
  shadow?: PalIndex;
}

/**
 * Smooth text is not stamped into the 180px framebuffer (that would turn it
 * into a blurry pixel blob); it is queued here and drawn at full device
 * resolution on top of the scaled-up frame.
 */
export class TextLayer {
  cmds: TextCmd[] = [];
  /** the framebuffer whose text goes to this layer */
  target: FB | null = null;
  private meter: { font: string; measureText(t: string): { width: number } };
  private widths = new Map<string, number>();

  constructor(makeCanvas: () => { getContext(type: '2d'): any }) {
    const ctx = makeCanvas().getContext('2d');
    ctx.font = `700 100px ${CRISP_STACK}`;
    this.meter = ctx;
  }

  width(text: string, size: number): number {
    let w = this.widths.get(text);
    if (w === undefined) {
      this.meter.font = `700 100px ${CRISP_STACK}`;
      w = this.meter.measureText(text).width;
      if (this.widths.size > 3000) this.widths.clear();
      this.widths.set(text, w);
    }
    return (w * size) / 100;
  }

  flush(ctx: CanvasRenderingContext2D, offX: number, offY: number, scale: number): void {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    for (const c of this.cmds) {
      ctx.font = `700 ${c.size * scale}px ${CRISP_STACK}`;
      const x = offX + c.x * scale;
      const y = offY + (c.y + (BASELINE * c.size) / CRISP_SIZE) * scale;
      if (c.outline !== undefined) {
        ctx.strokeStyle = HEX[c.outline];
        ctx.lineWidth = Math.max(2, (c.size / CRISP_SIZE) * 2.2 * scale);
        ctx.strokeText(c.text, x, y);
      }
      if (c.shadow !== undefined) {
        ctx.fillStyle = HEX[c.shadow];
        const d = (c.size / CRISP_SIZE) * scale;
        ctx.fillText(c.text, x + d, y + d);
      }
      ctx.fillStyle = HEX[c.color];
      ctx.fillText(c.text, x, y);
    }
    this.cmds.length = 0;
  }
}

let layer: TextLayer | null = null;

export function setTextLayer(l: TextLayer | null): void {
  layer = l;
}

const HAS_CJK = /[⺀-鿿＀-￯　-〿]/;

function useCrisp(fb: FB | null, text: string, pixel: boolean | undefined): boolean {
  if (!layer) return false;
  if (fb && fb !== layer.target) return false;
  return !pixel || HAS_CJK.test(text);
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
  /** force the bitmap pixel font (logo, banners, big numbers); everything else is smooth text */
  pixel?: boolean;
}

export function measure(text: string, scale = 1, tracking = 0, pixel = false): number {
  if (useCrisp(null, text, pixel)) return Math.round(layer!.width(text, CRISP_SIZE * scale));
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
    const lines = o.wrapW !== undefined ? wrap(text, o.wrapW, o.scale ?? 1, o.pixel) : text.split('\n');
    const { wrapW: _w, ...rest } = o;
    void _w;
    let widest = 0;
    lines.forEach((ln, i) => {
      widest = Math.max(widest, drawText(fb, ln, x, y + i * LINE_H * (o.scale ?? 1), color, rest));
    });
    return widest;
  }
  const scale = o.scale ?? 1;
  if (useCrisp(fb, text, o.pixel)) {
    const size = CRISP_SIZE * scale;
    const w = Math.round(layer!.width(text, size));
    let lx = x;
    if (o.align === 'center') lx = Math.round(x - w / 2);
    else if (o.align === 'right') lx = x - w;
    // smooth text always gets a dark edge unless it has its own shadow, so it stays readable on any background
    const outline = o.outline ?? (o.shadow === undefined ? C.ink : undefined);
    layer!.cmds.push({ text, x: lx, y, color, size, outline, shadow: o.shadow });
    return w;
  }
  const tracking = o.tracking ?? 0;
  const width = measure(text, scale, tracking, true);
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
export function wrap(text: string, maxW: number, scale = 1, pixel = false): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    // tokens: a run of non-CJK non-space chars, a single CJK char, or a space
    const tokens = para.match(/[^\s⺀-鿿＀-￯　-〿]+|[⺀-鿿＀-￯　-〿]|\s+/g) ?? [];
    for (const tok of tokens) {
      const trial = line + tok;
      if (measure(trial, scale, 0, pixel) <= maxW || line === '') {
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
