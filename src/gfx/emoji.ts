import { FB, makeSprite, T, type Sprite } from './fb';
import { C, nearestLut } from './palette';
import { ICON } from './icons';

/**
 * Emoji → pixel-art icon. The system's colour emoji is drawn tiny, every pixel
 * is snapped to our 16-colour palette and the result gets an ink outline, so
 * picture hints match the rest of the game instead of looking pasted in.
 */
const cache = new Map<string, Sprite>();

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

export function emojiSprite(emoji: string, size = 24): Sprite {
  const key = `${emoji}@${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = render(emoji, size) ?? fallback();
  cache.set(key, sprite);
  return sprite;
}

function fallback(): Sprite {
  return ICON.question;
}

function render(emoji: string, size: number): Sprite | null {
  if (typeof document === 'undefined') return null;
  const inner = size - 2; // room for the outline
  const cv = document.createElement('canvas');
  cv.width = inner;
  cv.height = inner;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, inner, inner);
  ctx.font = `${Math.round(inner * 0.86)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, inner / 2, inner / 2 + inner * 0.06);
  const data = ctx.getImageData(0, 0, inner, inner).data;
  const lut = nearestLut();

  const body = new FB(size, size);
  body.clear(T);
  let opaque = 0;
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const i = (y * inner + x) * 4;
      if (data[i + 3] < 120) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      body.set(x + 1, y + 1, lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]);
      opaque += 1;
    }
  }
  if (opaque < 6) return null; // the font had no glyph for it
  const out = makeSprite(size, size);
  out.px.set(body.px);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (body.px[y * size + x] !== T) continue;
      const near =
        (x > 0 && body.px[y * size + x - 1] !== T) ||
        (x < size - 1 && body.px[y * size + x + 1] !== T) ||
        (y > 0 && body.px[(y - 1) * size + x] !== T) ||
        (y < size - 1 && body.px[(y + 1) * size + x] !== T);
      if (near) out.px[y * size + x] = C.ink;
    }
  }
  return out;
}
