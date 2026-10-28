import type { App, Scene } from '../core/app';
import type { FB } from '../gfx/fb';
import { C } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN, panel } from '../gfx/ui';
import { drawText } from '../gfx/text';
import { emojiSprite } from '../gfx/emoji';
import { sfx } from '../audio/sfx';
import { advance, currentNode, isFinished, nextRelic, RELICS } from '../game/run';
import { startRun } from '../game/save';
import { backdrop, bob, banner, partyRow } from './common';
import { TitleScene } from './title';
import { PlayersScene } from './players';
import { ScanScene } from './scan';

function nodePos(app: App, i: number, total: number): { x: number; y: number } {
  const top = 72;
  const bottom = app.H - 78;
  const y = bottom - (i * (bottom - top)) / (total - 1);
  const x = app.W / 2 + Math.sin(i * 1.15 + 0.4) * 46;
  return { x: Math.round(x), y: Math.round(y) };
}

export class MapScene implements Scene {
  readonly id = 'map';
  private walk = 1;
  private from = 0;

  /** `fromIdx`: the node the party just left, so the token can walk to the next one. */
  constructor(private app: App, fromIdx?: number) {
    const run = app.save.run;
    if (run && fromIdx !== undefined && fromIdx < run.idx) {
      this.from = fromIdx;
      this.walk = 0;
    }
  }

  enter(): void {
    sfx.setMusic('map');
    this.app.closeCamera();
    if (this.walk < 1) sfx.play('step');
  }

  update(dt: number): void {
    if (this.walk < 1) {
      const before = Math.floor(this.walk * 6);
      this.walk = Math.min(1, this.walk + dt / 0.8);
      if (Math.floor(this.walk * 6) !== before) sfx.play('step', before);
      if (this.walk >= 1 && this.app.save.run && isFinished(this.app.save.run)) {
        this.app.go(new FinishScene(this.app));
      }
    }
  }

  private go(): void {
    const app = this.app;
    const run = app.save.run;
    if (!run) return;
    const node = currentNode(run);
    if (!node) return;
    sfx.unlock();
    sfx.play('select');
    if (node.type === 'chest') app.go(new ChestScene(app));
    else app.go(new ScanScene(app, node.type === 'boss'));
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    const run = app.save.run;
    if (!run) {
      app.go(new TitleScene(app));
      return;
    }
    const node = currentNode(run) ?? run.nodes[run.nodes.length - 1];
    fb.copyFrom(backdrop(app, node.theme, 5 + run.idx));
    fb.veil(0, 0, W, H, C.ink, 4);

    // ---- trail
    const total = run.nodes.length;
    const pos = run.nodes.map((_, i) => nodePos(app, i, total));
    for (let i = 0; i < total - 1; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = Math.round(a.x + (b.x - a.x) * t);
        const y = Math.round(a.y + (b.y - a.y) * t);
        const col = i < run.idx ? C.sun : C.slate;
        fb.rect(x - 1, y - 1, 2, 2, C.ink);
        fb.rect(x, y, 1, 1, col);
      }
    }

    // ---- nodes
    run.nodes.forEach((n, i) => {
      const { x, y } = pos[i];
      const done = i < run.idx;
      const cur = i === run.idx;
      const face = done ? C.leaf : cur ? C.orange : C.dusk;
      const rim = done ? C.lime : cur ? C.sun : C.slate;
      const r = n.type === 'boss' ? 11 : 9;
      const oy = cur ? bob(app.t, 1.5, 5) : 0;
      if (cur) {
        const k = (app.t * 1.2) % 1;
        fb.ring(x, y + oy, Math.round(r + 2 + k * 6), C.sun);
      }
      fb.disc(x, y + 1 + oy, r + 1, C.ink);
      fb.disc(x, y + oy, r, rim);
      fb.disc(x, y + oy, r - 1, face);
      const icon = done ? ICON.check : n.type === 'chest' ? ICON.chest : n.type === 'boss' ? ICON.skull : ICON.question;
      fb.blit(icon, x - Math.floor(icon.w / 2), y - Math.floor(icon.h / 2) + oy, { alpha: done || cur ? 16 : 7 });
      if (cur) app.ui.zone(x - 14, y - 14, 28, 28, () => this.go(), 'node');
    });

    // ---- the party token walks along the trail
    const cur = Math.min(run.idx, total - 1);
    const a = pos[this.from];
    const b = pos[cur];
    const t = this.walk;
    const tx = Math.round(a.x + (b.x - a.x) * t);
    const ty = Math.round(a.y + (b.y - a.y) * t);
    const hop = t < 1 ? Math.abs(bob(app.t, 3, 14)) : bob(app.t, 1, 4);
    const who = app.active;
    drawFlag(fb, tx + 11, ty - 22 - hop);
    void who;

    // ---- top bar
    panel(fb, 4, 4, W - 8, 28, C.dusk, C.slate);
    partyRow(app, 8, -1, { pips: true });
    app.ui.zone(4, 4, W - 8, 28, () => {
      sfx.play('tap');
      app.go(new PlayersScene(app, () => app.go(new MapScene(app))));
    });
    drawText(fb, `TREK ${Math.min(run.idx + 1, total)}/${total}`, 8, 35, C.sun, { outline: C.ink });
    drawText(fb, `Relics ${app.save.relics.length}/${RELICS.length}`, W - 8, 35, C.ice, { align: 'right', outline: C.ink });

    // ---- bottom buttons
    const label = node.type === 'chest' ? 'OPEN CHEST' : node.type === 'boss' ? 'BOSS BATTLE!' : 'FIND A MONSTER';
    const style = node.type === 'boss' ? BTN.danger : node.type === 'chest' ? BTN.gold : BTN.primary;
    if (this.walk >= 1) {
      app.ui.button(fb, 12, H - 40, W - 24, 24, label, style, () => this.go());
    }
    app.ui.button(fb, 6, H - 14, 24, 11, 'MENU', BTN.dark, () => {
      sfx.play('back');
      app.go(new TitleScene(app));
    });
  }
}

function drawFlag(fb: FB, x: number, y: number): void {
  fb.rect(x, y, 1, 14, C.ink);
  fb.rect(x + 1, y, 7, 5, C.ink);
  fb.rect(x + 1, y + 1, 6, 3, C.berry);
  fb.rect(x + 1, y + 1, 6, 1, C.orange);
}

// ---------------------------------------------------------------------------

/** Native-resolution treasure chest, `open` 0..1. */
function drawChest(fb: FB, cx: number, by: number, open: number): void {
  const w = 44;
  const x = cx - w / 2;
  const bodyH = 20;
  const y = by - bodyH;
  // body
  fb.rect(x, y, w, bodyH, C.ink);
  fb.rect(x + 1, y + 1, w - 2, bodyH - 2, C.orange);
  fb.rect(x + 1, y + bodyH - 6, w - 2, 5, C.berry);
  for (let i = 1; i < 4; i++) fb.rect(x + 1 + i * 10, y + 1, 1, bodyH - 2, C.berry);
  fb.rect(x + 1, y + 1, w - 2, 1, C.sun);
  // metal bands
  for (const bx of [x + 4, x + w - 8]) {
    fb.rect(bx, y, 4, bodyH, C.ink);
    fb.rect(bx + 1, y + 1, 2, bodyH - 2, C.mist);
    fb.rect(bx + 1, y + 1, 1, bodyH - 2, C.snow);
  }
  // inside glow when open
  if (open > 0.05) {
    fb.rect(x + 2, y - 3, w - 4, 5, C.sun);
    fb.veil(x - 6, y - 24, w + 12, 28, C.sun, Math.round(open * 7));
  }
  // lid
  const lidH = 12;
  if (open < 0.5) {
    const ly = y - lidH + 1 - Math.round(open * 8);
    fb.rect(x, ly, w, lidH, C.ink);
    fb.rect(x + 1, ly + 1, w - 2, lidH - 2, C.orange);
    fb.rect(x + 1, ly + 1, w - 2, 2, C.sun);
    fb.rect(x + 4, ly, 4, lidH, C.mist);
    fb.rect(x + w - 8, ly, 4, lidH, C.mist);
  } else {
    // tipped back: draw as a thin slab above and behind
    const ly = y - 26;
    fb.rect(x + 2, ly, w - 4, 10, C.ink);
    fb.rect(x + 3, ly + 1, w - 6, 8, C.berry);
    fb.rect(x + 3, ly + 1, w - 6, 2, C.orange);
  }
  // lock
  if (open < 0.4) {
    fb.rect(cx - 3, y - 4, 6, 8, C.ink);
    fb.rect(cx - 2, y - 3, 4, 6, C.sun);
    fb.set(cx, y - 1, C.ink);
  }
}

export class ChestScene implements Scene {
  readonly id = 'chest';
  private phase: 'closed' | 'opening' | 'open' = 'closed';
  private t = 0;
  private relic: ReturnType<typeof nextRelic>;

  constructor(private app: App) {
    this.relic = nextRelic(app.save.relics, app.save.treks * 7 + (app.save.run?.idx ?? 0));
  }

  enter(): void {
    sfx.setMusic('map');
  }

  private tap(): void {
    if (this.phase !== 'closed') return;
    sfx.unlock();
    this.phase = 'opening';
    this.t = 0;
    this.app.fx.shake(2, 0.3);
    sfx.play('chest');
  }

  update(dt: number): void {
    if (this.phase === 'closed') return;
    this.t += dt;
    if (this.phase === 'opening' && this.t > 0.7) {
      this.phase = 'open';
      this.t = 0;
      this.app.fx.flash(C.snow, 0.25);
      this.app.fx.burst(this.app.W / 2, this.app.H * 0.38, 26, [C.sun, C.snow, C.ice, C.orange], 80, 70, 1);
      sfx.play('perfect');
    }
  }

  private finish(): void {
    const app = this.app;
    const run = app.save.run;
    if (!run) return;
    const owned = app.save.relics.includes(this.relic.id) ? app.save.relics : [...app.save.relics, this.relic.id];
    const from = run.idx;
    app.save = { ...app.save, relics: owned, run: advance(run) };
    app.persist();
    app.go(new MapScene(app, from));
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    const node = currentNode(app.save.run!) ?? { theme: 'meadow' as const };
    fb.copyFrom(backdrop(app, node.theme, 90));
    fb.veil(0, 0, W, H, C.ink, 6);

    const cy = Math.round(H * 0.5);
    const open = this.phase === 'closed' ? 0 : this.phase === 'opening' ? Math.min(1, this.t / 0.5) : 1;
    const shakeX = this.phase === 'opening' ? Math.round(Math.sin(this.t * 70) * 1.5) : 0;
    drawChest(fb, W / 2 + shakeX, cy, open);

    if (this.phase === 'closed') {
      banner(app, 'A TREASURE CHEST!', 40, C.sun, 1);
      drawText(fb, '找到寶箱了！點一下打開', W / 2, 62, C.snow, { align: 'center', outline: C.ink });
      app.ui.zone(0, 0, W, H, () => this.tap());
      app.ui.button(fb, 30, H - 44, W - 60, 24, 'OPEN!', BTN.gold, () => this.tap());
    } else if (this.phase === 'open') {
      const rise = Math.min(1, this.t / 0.5);
      const sp = emojiSprite(this.relic.icon, 28);
      const y = Math.round(cy - 34 - rise * 26 + bob(app.t, 1.5, 4));
      fb.blit(sp, Math.round(W / 2 - sp.w / 2), y);
      if (Math.floor(app.t * 10) % 3 === 0) app.fx.sparkle(W / 2 - 16, y, 32, 28, 1, [C.sun, C.snow]);
      banner(app, this.relic.name, 40, C.sun, 1);
      drawText(fb, this.relic.zh, W / 2, 62, C.snow, { align: 'center', outline: C.ink });
      const isNew = !app.save.relics.includes(this.relic.id);
      drawText(fb, isNew ? 'NEW!' : 'again!', W / 2, 78, isNew ? C.lime : C.mist, { align: 'center', outline: C.ink });
      app.ui.button(fb, 30, H - 44, W - 60, 24, 'CONTINUE', BTN.primary, () => {
        sfx.play('select');
        this.finish();
      });
    }
  }
}

// ---------------------------------------------------------------------------

export class FinishScene implements Scene {
  readonly id = 'finish';
  private t = 0;
  private done = false;

  constructor(private app: App) {}

  enter(): void {
    sfx.setMusic('map');
    sfx.play('win');
    this.app.fx.flash(C.snow, 0.4);
    // count the finished trek right away: a quick tap on NEW TREK must not skip it
    if (!this.done) {
      this.done = true;
      this.app.save = { ...this.app.save, treks: this.app.save.treks + 1, run: null };
      this.app.persist();
    }
  }

  update(dt: number): void {
    this.t += dt;
    const app = this.app;
    if (Math.floor(this.t * 12) !== Math.floor((this.t - dt) * 12)) {
      app.fx.burst(app.rng.range(20, app.W - 20), app.rng.range(30, 120), 8, [C.sun, C.orange, C.ice, C.lime, C.berry, C.snow], 70, 90, 1);
    }
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    fb.copyFrom(backdrop(app, 'sunset', 3));
    banner(app, 'TREK CLEAR!', 40, C.sun, 2);
    drawText(fb, '你們完成了冒險！', W / 2, 78, C.snow, { align: 'center', outline: C.ink });

    panel(fb, 14, 100, W - 28, 24 + app.save.players.length * 14 + 8, C.dusk, C.slate);
    drawText(fb, `Words beaten: ${app.save.collection.length}`, 22, 108, C.ice);
    app.save.players.forEach((p, i) => {
      drawText(fb, `${p.name}`, 22, 124 + i * 14, C.snow);
      drawText(fb, `${p.stats.words} spells`, W - 22, 124 + i * 14, C.sun, { align: 'right' });
    });
    app.ui.button(fb, 20, H - 62, W - 40, 24, 'NEW TREK', BTN.primary, () => {
      sfx.play('select');
      app.save = startRun(app.save);
      app.persist();
      app.go(new MapScene(app));
    });
    app.ui.button(fb, 20, H - 34, W - 40, 20, 'MENU', BTN.gray, () => {
      sfx.play('back');
      app.go(new TitleScene(app));
    });
  }
}
