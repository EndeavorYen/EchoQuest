import type { App, Scene } from '../core/app';
import type { FB } from '../gfx/fb';
import { C, RAMPS, type PalIndex } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN } from '../gfx/ui';
import { drawText } from '../gfx/text';
import { emojiSprite } from '../gfx/emoji';
import { vignette } from '../gfx/backdrop';
import { generateMonster, type Monster, type MonsterSpec } from '../gfx/monster';
import { TODDLER_TAPS, growthSpecs, addSticker } from '../game/toddler';
import { sfx, say } from '../audio/sfx';
import { WORDS, type Word } from '../data/words';
import { backdrop, bob, banner, groundShadow } from './common';
import { TitleScene } from './title';
import { ScanScene } from './scan';

/**
 * Toddler mode: no speaking, no reading, no losing. Scan something, tap the new
 * friend — every tap answers instantly with a sound and a change — and after a
 * few taps it grows up into a sticker for the book.
 */
export class ToddlerScene implements Scene {
  readonly id = 'toddler';
  private looks: Monster[];
  private taps = 0;
  private squash = 0;
  private idle = 0;
  private done = false;
  private doneT = 0;
  private word: Word;
  private shown = 0;

  constructor(private app: App, private bg: FB, spec: MonsterSpec) {
    this.looks = growthSpecs(spec).map(generateMonster);
    const pool = WORDS.filter((w) => w.lv === 1 && w.icon);
    this.word = pool[app.rng.int(0, pool.length - 1)] ?? WORDS[0];
  }

  enter(): void {
    sfx.setMusic('map');
  }

  private get monster(): Monster {
    return this.looks[Math.min(this.taps, TODDLER_TAPS - 1)];
  }

  private get groundY(): number {
    return Math.round(this.app.H * 0.55);
  }

  private tap(): void {
    if (this.done) return;
    const app = this.app;
    sfx.unlock();
    this.taps += 1;
    this.idle = 0;
    this.squash = 0.35;
    const cx = app.W / 2;
    const m = this.monster;
    const cy = this.groundY - m.size / 2;
    // instant: a sound, a squish, sparkles and the English word out loud
    sfx.play('combo', this.taps);
    say(this.word.w);
    app.fx.burst(cx, cy, 14, [...RAMPS[m.spec.ramp], C.snow] as PalIndex[], 80, 80, 0.7);
    app.fx.ring(cx, cy, C.sun);
    app.fx.shake(1, 0.15);
    app.fx.float(cx, this.groundY - m.size - 8, ['YAY!', 'WOW!', 'COOL!', 'NICE!', 'SUPER!'][Math.min(this.taps, 5) - 1], C.sun, 2, C.ink);
    if (this.taps >= TODDLER_TAPS) this.grow();
  }

  private grow(): void {
    const app = this.app;
    this.done = true;
    this.doneT = 0;
    sfx.play('win');
    app.fx.flash(C.snow, 0.3);
    app.fx.burst(app.W / 2, this.groundY - 20, 40, [C.sun, C.snow, C.ice, C.lime, C.orange], 100, 80, 1.2);
    const sticker = this.looks[TODDLER_TAPS - 1].spec;
    app.save = { ...app.save, stickers: addSticker(app.save.stickers, sticker) };
    app.persist();
  }

  update(dt: number): void {
    this.idle += dt;
    if (this.squash > 0) this.squash -= dt;
    if (this.done) this.doneT += dt;
    // fill the star row smoothly
    if (this.shown < this.taps) this.shown = Math.min(this.taps, this.shown + dt * 8);
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    fb.copyFrom(this.bg);
    fb.veil(0, 0, W, H, C.ink, 4);
    vignette(fb, 0.8);

    // progress: five stars
    for (let i = 0; i < TODDLER_TAPS; i++) {
      const on = i < this.taps;
      const x = Math.round(W / 2 - (TODDLER_TAPS * 16) / 2) + i * 16 + 2;
      fb.blit(ICON.star, x, 8, { alpha: on ? 16 : 5 });
    }

    // the friend
    const m = this.monster;
    const gy = this.groundY;
    const k = this.squash > 0 ? this.squash / 0.35 : 0;
    const sw = Math.round(m.size * 2 * (1 + 0.18 * k));
    const sh = Math.round(m.size * 2 * (1 - 0.18 * k));
    const big = m.size * 2;
    const x = Math.round(W / 2 - sw / 2) + app.fx.offset.x;
    const y = gy - sh + Math.round((m.size - m.groundY) * 2) + bob(app.t, 2, 3) + app.fx.offset.y;
    groundShadow(fb, W / 2, gy + 1, Math.round(m.size * 0.6));
    fb.blitStretch(m.frames[k > 0 ? 'open' : 'idle'], x, y, sw, sh, {});
    void big;
    if (!this.done) app.ui.zone(Math.round(W / 2 - m.size), gy - m.size * 2, m.size * 2, m.size * 2 + 10, () => this.tap(), 'friend');

    // a hand that pulses when nothing has happened for a moment
    if (!this.done && this.idle > 2.5) {
      const hy = gy - m.size + Math.round(Math.sin(app.t * 6) * 3);
      fb.blit(ICON.arrowL, Math.round(W / 2 + m.size * 0.8), hy, { alpha: 16 });
      drawText(fb, 'TAP!', Math.round(W / 2 + m.size * 0.8) + 12, hy, C.sun, { outline: C.ink, pixel: true });
    }

    // the friend's word, as a picture bubble (no reading needed)
    if (this.word.icon) {
      const sp = emojiSprite(this.word.icon, 26);
      fb.rect(W - 38, 24, 30, 30, C.navy);
      fb.frame(W - 38, 24, 30, 30, C.ink);
      fb.blit(sp, W - 38 + Math.round((30 - sp.w) / 2), 24 + Math.round((30 - sp.h) / 2));
      app.ui.zone(W - 38, 24, 30, 30, () => { sfx.unlock(); sfx.play('tap'); say(this.word.w); }, 'word');
    }

    if (this.done) {
      banner(app, 'NEW STICKER!', 30, C.sun, 2);
      // the sticker pops in
      const p = Math.min(1, this.doneT / 0.5);
      const s = this.looks[TODDLER_TAPS - 1];
      const size = Math.round(36 * p);
      if (size > 4) {
        fb.rect(W / 2 - 24, gy + 26, 48, 48, C.snow);
        fb.frame(W / 2 - 24, gy + 26, 48, 48, C.ink);
        fb.blitStretch(s.frames.idle, Math.round(W / 2 - size / 2), gy + 32, size, size, {});
      }
      if (this.doneT > 1.0) {
        app.ui.button(fb, 20, H - 72, W - 40, 24, 'AGAIN!', BTN.primary, () => {
          sfx.play('select');
          app.go(new ScanScene(app, false, true));
        }, { name: 'again' });
        app.ui.button(fb, 20, H - 44, (W - 44) / 2, 20, 'BOOK', BTN.blue, () => { sfx.play('select'); app.go(new StickerBookScene(app)); });
        app.ui.button(fb, 24 + (W - 44) / 2, H - 44, (W - 44) / 2, 20, 'HOME', BTN.gray, () => { sfx.play('back'); app.go(new TitleScene(app)); });
      }
    } else {
      app.ui.button(fb, 6, H - 22, 30, 14, 'BACK', BTN.dark, () => { sfx.play('back'); app.go(new TitleScene(app)); });
    }
  }
}

/** Every sticker the little ones have collected, newest first. */
export class StickerBookScene implements Scene {
  readonly id = 'stickers';
  private looks: Monster[];

  constructor(private app: App) {
    this.looks = app.save.stickers.slice(0, 12).map(generateMonster);
  }

  update(): void {}

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    fb.copyFrom(backdrop(app, 'night', 55));
    fb.veil(0, 0, W, H, C.ink, 10);
    drawText(fb, 'STICKERS', W / 2, 8, C.sun, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    drawText(fb, `${app.save.stickers.length}`, W / 2, 30, C.ice, { align: 'center', outline: C.ink });
    const cols = 3;
    const cell = 52;
    const x0 = Math.round((W - cols * cell) / 2);
    this.looks.forEach((m, i) => {
      const cx = x0 + (i % cols) * cell;
      const cy = 48 + Math.floor(i / cols) * cell;
      fb.rect(cx + 2, cy + 2, cell - 4, cell - 4, C.snow);
      fb.frame(cx + 2, cy + 2, cell - 4, cell - 4, C.ink);
      fb.blitStretch(m.frames.idle, cx + 6, cy + 6, cell - 12, cell - 12, {});
    });
    if (this.looks.length === 0) drawText(fb, 'Tap a friend 5 times!', W / 2, 90, C.mist, { align: 'center', outline: C.ink });
    app.ui.button(fb, 20, H - 30, W - 40, 22, 'BACK', BTN.primary, () => { sfx.play('back'); app.go(new TitleScene(app)); });
  }
}
