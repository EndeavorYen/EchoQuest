/**
 * Node-side helpers so the exact same framebuffer code can be rendered to PNG
 * for visual review without a browser.
 */
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FB } from '../src/gfx/fb';
import { canvasRasterizer, setRasterizer } from '../src/gfx/text';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const napi = require('@napi-rs/canvas') as typeof import('@napi-rs/canvas');

const FONT_DIR = join(
  process.cwd(),
  'node_modules/@vp-tw/cjk-web-fonts-fusion-pixel-font/dist/12px/proportional/zh_hant',
);

let fontsReady = false;

export function initNodeText(): void {
  if (fontsReady) return;
  const files = readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2'));
  const aliases: string[] = [];
  files.forEach((f, i) => {
    const alias = `fp${i}`;
    if (napi.GlobalFonts.registerFromPath(join(FONT_DIR, f), alias)) aliases.push(`"${alias}"`);
  });
  setRasterizer(canvasRasterizer((w, h) => napi.createCanvas(w, h), aliases.join(', ')));
  fontsReady = true;
}

export function savePNG(fb: FB, path: string, scale = 3): void {
  const small = napi.createCanvas(fb.w, fb.h);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(fb.w, fb.h);
  fb.toRGBA(img.data);
  sctx.putImageData(img, 0, 0);

  const big = napi.createCanvas(fb.w * scale, fb.h * scale);
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, fb.w * scale, fb.h * scale);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, big.toBuffer('image/png'));
}

/** Lay several framebuffers side by side into one PNG (contact sheet). */
export function saveSheet(fbs: FB[], path: string, scale = 3, gap = 4): void {
  const w = fbs.reduce((a, f) => a + f.w + gap, gap);
  const h = Math.max(...fbs.map((f) => f.h)) + gap * 2;
  const sheet = new FB(w, h);
  sheet.clear(15);
  let x = gap;
  for (const f of fbs) {
    sheet.copyFrom(f, x, gap);
    x += f.w + gap;
  }
  savePNG(sheet, path, scale);
}

export function loadImageRGBA(path: string): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  return napi.loadImage(path).then((img) => {
    const c = napi.createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height);
    return { w: img.width, h: img.height, data: d.data as unknown as Uint8ClampedArray };
  });
}
