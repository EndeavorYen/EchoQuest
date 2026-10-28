import type { App } from '../core/app';
import { FB } from '../gfx/fb';
import { C } from '../gfx/palette';
import { makeBackdrop, type Theme } from '../gfx/backdrop';
import { drawText, measure } from '../gfx/text';
import { avatarSprite } from '../gfx/ui';
import { LEVELS } from '../data/words';
import type { Player } from '../game/model';

const bgCache = new Map<string, FB>();

/** Procedural backdrop for the current screen size (cached). */
export function backdrop(app: App, theme: Theme, seed = 7): FB {
  const key = `${theme}:${seed}:${app.W}x${app.H}`;
  let bg = bgCache.get(key);
  if (!bg) {
    if (bgCache.size > 12) bgCache.clear();
    bg = makeBackdrop(app.W, app.H, seed, theme);
    bgCache.set(key, bg);
  }
  return bg;
}

/** Integer "bob" so sprites hop whole pixels instead of smearing. */
export function bob(t: number, amp = 1.5, speed = 3, phase = 0): number {
  return Math.round(Math.sin(t * speed + phase) * amp);
}

export function levelName(lv: number): string {
  return LEVELS.find((l) => l.lv === lv)?.name ?? '';
}

/** Soft ground shadow: dithered ink ellipse. */
export function groundShadow(fb: FB, cx: number, cy: number, rx: number, ry = 3): void {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      const lvl = d < 0.45 ? 11 : 6;
      const xx = cx + x;
      const yy = cy + y;
      // ordered dither toward ink
      if (((xx + yy * 2) & 3) < (lvl >> 2) + 1) fb.set(xx, yy, C.ink);
    }
  }
}

/** Level pips: 1–4 small squares, filled up to `lv`. */
export function levelPips(fb: FB, x: number, y: number, lv: number): void {
  for (let i = 0; i < 4; i++) {
    fb.rect(x + i * 4, y, 3, 3, i < lv ? C.sun : C.slate);
  }
}

/** Row of party members. The highlighted one bounces. */
export function partyRow(app: App, y: number, highlight = -1, opts: { pips?: boolean } = {}): void {
  const fb = app.fb;
  const players = app.save.players;
  const slot = 36;
  const total = players.length * slot;
  let x = Math.round((app.W - total) / 2);
  players.forEach((p, i) => {
    const hop = i === highlight ? bob(app.t, 1.2, 8) - 1 : 0;
    const sp = avatarSprite(p.face);
    const ax = x + Math.round((slot - sp.w) / 2);
    if (i === highlight) {
      fb.rect(x + 1, y - 4, slot - 2, 20, C.dusk);
      fb.frame(x + 1, y - 4, slot - 2, 20, C.sun);
    }
    fb.blit(sp, ax, y + hop);
    if (opts.pips) levelPips(fb, x + Math.round((slot - 15) / 2), y + 13, p.level);
    x += slot;
  });
}

/** Big banner text with a dark strip behind it. */
export function banner(app: App, text: string, y: number, color: number, scale = 2): void {
  const fb = app.fb;
  const w = measure(text, scale);
  const h = 14 * scale + 6;
  fb.veil(0, y - 3, app.W, h, C.ink, 13);
  fb.rect(0, y - 3, app.W, 1, color);
  fb.rect(0, y - 3 + h - 1, app.W, 1, color);
  drawText(fb, text, Math.round((app.W - w) / 2), y, color, { scale, outline: C.ink });
}

export function playerLabel(p: Player): string {
  return `${p.name}`;
}
