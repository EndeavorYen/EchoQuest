import type { App, Scene } from '../core/app';
import { C } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN } from '../gfx/ui';
import { drawText, measure } from '../gfx/text';
import { generateMonster, randomSpec, type Monster } from '../gfx/monster';
import { vignette } from '../gfx/backdrop';
import { sfx } from '../audio/sfx';
import { startRun } from '../game/save';
import { isFinished } from '../game/run';
import { backdrop, bob, groundShadow } from './common';
import { PlayersScene } from './players';
import { MapScene } from './map';
import { PracticeScene } from './practice';
import { ScanScene } from './scan';

export class TitleScene implements Scene {
  readonly id = 'title';
  private mascot: Monster;
  private friends: Monster[];
  private blink = 0;
  private nextBlink = 2;
  private sparkleT = 0;

  constructor(private app: App) {
    this.mascot = generateMonster(randomSpec(2026, 'leaf'));
    this.friends = [
      generateMonster(randomSpec(11, 'water')),
      generateMonster(randomSpec(23, 'fire')),
    ];
  }

  enter(): void {
    sfx.setMusic('map');
  }

  update(dt: number): void {
    const app = this.app;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.12;
      this.nextBlink = 2 + app.rng.next() * 3;
    }
    if (this.blink > 0) this.blink -= dt;
    this.sparkleT -= dt;
    if (this.sparkleT <= 0) {
      this.sparkleT = 0.25;
      app.fx.sparkle(app.rng.range(10, app.W - 10), app.rng.range(20, app.H * 0.5), 2, 2, 1, [C.sun, C.snow, C.ice]);
    }
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    fb.copyFrom(backdrop(app, 'night', 21));
    vignette(fb, 0.7);

    // ---- logo
    const wave = (text: string, y: number, color: number, shadow: number, scale: number) => {
      const total = measure(text, scale, 1, true);
      let x = Math.round((W - total) / 2);
      let i = 0;
      for (const ch of text) {
        const dy = bob(app.t, 2, 3, i * 0.7);
        const w = drawText(fb, ch, x, y + dy, color, { scale, outline: C.ink, shadow, pixel: true });
        x += w + scale + 1;
        i += 1;
      }
    };
    wave('Echo', 22, C.sun, C.orange, 3);
    wave('Quest', 22 + 44, C.ice, C.royal, 3);
    drawText(fb, '說出咒語，打敗怪物！', W / 2, 22 + 44 + 46, C.snow, { align: 'center', outline: C.ink });

    // ---- the cast
    const gy = Math.round(H * 0.6);
    const draw = (m: Monster, cx: number, flip: boolean, phase: number, scale = 1) => {
      const frame = this.blink > 0 ? m.frames.blink : m.frames.idle;
      const x = cx - Math.round((m.size * scale) / 2);
      const y = gy - m.groundY * scale + bob(app.t, 1.5, 3, phase);
      groundShadow(fb, cx, gy + 1, 18);
      fb.blit(frame, x, y, { flipX: flip, scale });
    };
    draw(this.friends[0], 34, false, 1.2);
    draw(this.friends[1], W - 34, true, 2.4);
    draw(this.mascot, W / 2, false, 0);

    // ---- buttons
    const run = app.save.run;
    const inProgress = !!run && !isFinished(run) && run.idx > 0;
    const bw = 124;
    const bx = Math.round((W - bw) / 2);
    let by = gy + 18;
    app.ui.button(fb, bx, by, bw, 24, inProgress ? 'CONTINUE' : 'START', BTN.primary, () => {
      sfx.unlock();
      sfx.play('select');
      if (!app.save.run || isFinished(app.save.run)) app.save = startRun(app.save);
      app.persist();
      app.go(new MapScene(app));
    }, { textScale: 1 });
    by += 28;
    if (inProgress) {
      app.ui.button(fb, bx, by, bw, 18, 'NEW TREK', BTN.gray, () => {
        sfx.play('tap');
        app.save = startRun(app.save);
        app.persist();
        app.go(new MapScene(app));
      });
      by += 22;
    }
    const half = (bw - 4) / 2;
    app.ui.button(fb, bx, by, half, 20, 'PARTY', BTN.blue, () => {
      sfx.play('select');
      app.go(new PlayersScene(app, () => app.go(new TitleScene(app))));
    });
    app.ui.button(fb, bx + half + 4, by, half, 20, 'PRACTICE', BTN.green, () => {
      sfx.play('select');
      app.go(new PracticeScene(app));
    });
    by += 24;
    app.ui.button(fb, bx, by, bw, 18, 'TODDLER', BTN.gold, () => {
      sfx.unlock();
      sfx.play('select');
      app.go(new ScanScene(app, false, true));
    });

    // ---- sound toggles
    const tog = (x: number, on: boolean, label: string, cb: () => void) => {
      app.ui.button(fb, x, 6, 26, 16, label, on ? BTN.gray : BTN.dark, cb);
    };
    tog(W - 58, app.save.sound, app.save.sound ? 'SFX' : 'sfx', () => { sfx.unlock(); app.setSound(!app.save.sound); sfx.play('tap'); });
    tog(W - 30, app.save.music, app.save.music ? 'BGM' : 'bgm', () => {
      sfx.unlock();
      app.setMusic(!app.save.music);
      sfx.refreshMusic();
    });

    drawText(fb, 'v3', 4, H - 16, C.slate);
    void ICON;
  }
}
