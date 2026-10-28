import type { App, Scene } from '../core/app';
import { C } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN, avatarSprite, panel, AVATAR_COUNT } from '../gfx/ui';
import { drawText } from '../gfx/text';
import { MAX_PLAYERS, PLAYER_NAMES, newPlayer, type Level } from '../game/model';
import { LEVELS } from '../data/words';
import { sfx } from '../audio/sfx';
import { backdrop, levelPips } from './common';

/**
 * Party setup. Everyone picks their own level, and it can be changed at any
 * time — a parent who wants to revise can simply set themselves to 高中.
 */
export class PlayersScene implements Scene {
  constructor(private app: App, private back: () => void) {}

  enter(): void {
    sfx.unlock();
  }

  update(): void {}

  private change(i: number, delta: number): void {
    const app = this.app;
    const p = app.save.players[i];
    const lv = Math.max(1, Math.min(4, p.level + delta)) as Level;
    if (lv === p.level) return;
    app.save = {
      ...app.save,
      players: app.save.players.map((q, k) => (k === i ? { ...q, level: lv } : q)),
    };
    app.persist();
    sfx.play('tap');
  }

  private patch(i: number, patch: Partial<{ name: string; face: number }>): void {
    const app = this.app;
    app.save = {
      ...app.save,
      players: app.save.players.map((q, k) => (k === i ? { ...q, ...patch } : q)),
    };
    app.persist();
    sfx.play('tap');
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    fb.copyFrom(backdrop(app, 'night', 33));
    fb.veil(0, 0, W, H, C.ink, 11);

    drawText(fb, 'PARTY', W / 2, 8, C.sun, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    drawText(fb, '每個人選自己的等級，隨時可以換', W / 2, 36, C.mist, { align: 'center' });

    const players = app.save.players;
    const rowH = 54;
    players.forEach((p, i) => {
      const y = 54 + i * (rowH + 2);
      panel(fb, 8, y, W - 16, rowH, C.dusk, C.slate);
      // portrait (tap to change look)
      fb.rect(13, y + 6, 26, 24, C.navy);
      fb.frame(13, y + 6, 26, 24, C.ink);
      fb.blit(avatarSprite(p.face), 14, y + 8, { scale: 2 });
      app.ui.zone(13, y + 6, 26, 24, () => this.patch(i, { face: (p.face + 1) % AVATAR_COUNT }));
      // name (tap to cycle)
      drawText(fb, p.name, 46, y + 5, C.snow);
      const idx = PLAYER_NAMES.indexOf(p.name);
      app.ui.zone(44, y + 4, 70, 16, () => this.patch(i, { name: PLAYER_NAMES[(idx + 1) % PLAYER_NAMES.length] }));
      drawText(fb, '點名字可換', 46, y + 19, C.mist);
      // level
      const ly = y + 35;
      app.ui.button(fb, 14, ly, 18, 15, '', BTN.gray, () => this.change(i, -1), { icon: ICON.arrowL, disabled: p.level <= 1 });
      app.ui.button(fb, W - 8 - 5 - 18, ly, 18, 15, '', BTN.gray, () => this.change(i, 1), { icon: ICON.arrowR, disabled: p.level >= 4 });
      const info = LEVELS[p.level - 1];
      drawText(fb, `Lv.${p.level} ${info.name}`, W / 2, ly + 1, C.sun, { align: 'center' });
      levelPips(fb, W - 8 - 5 - 15, y + 24, p.level);
      // remove
      if (players.length > 1) {
        app.ui.button(fb, W - 8 - 5 - 14, y + 5, 14, 13, 'x', BTN.danger, () => {
          app.save = {
            ...app.save,
            players: app.save.players.filter((_, k) => k !== i),
            active: 0,
          };
          app.persist();
          sfx.play('back');
        });
      }
    });

    let by = 54 + players.length * (rowH + 2) + 2;
    if (players.length < MAX_PLAYERS) {
      app.ui.button(fb, 8, by, W - 16, 20, '+ ADD PLAYER', BTN.green, () => {
        app.save = { ...app.save, players: [...app.save.players, newPlayer(app.save.players.length, 1)] };
        app.persist();
        sfx.play('select');
      });
      by += 24;
    }
    app.ui.button(fb, 8, Math.max(by, H - 30), W - 16, 22, 'DONE', BTN.primary, () => {
      sfx.play('select');
      this.back();
    });
  }
}
