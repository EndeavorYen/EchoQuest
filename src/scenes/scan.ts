import type { App, Scene } from '../core/app';
import { FB } from '../gfx/fb';
import { C, RAMPS, type RampName } from '../gfx/palette';
import { BTN } from '../gfx/ui';
import { drawText } from '../gfx/text';
import { grabFrame } from '../gfx/camera';
import { vignette } from '../gfx/backdrop';
import { analyzeScene, pickRamp, type SceneAnalysis } from '../gfx/scene';
import { generateMonster, randomSpec, type Monster } from '../gfx/monster';
import { sfx } from '../audio/sfx';
import { currentNode } from '../game/run';
import { monsterHp, monsterName } from '../game/battle';
import { backdrop, bob, banner, groundShadow, partyRow } from './common';
import { MapScene } from './map';
import { BattleScene } from './battle';
import { TitleScene } from './title';
import { ToddlerScene } from './toddler';

type Mode = 'ask' | 'live' | 'fallback' | 'scan' | 'reveal';

export class ScanScene implements Scene {
  readonly id = 'scan';
  private mode: Mode = 'ask';
  private live: FB | null = null;
  private lastGrab = 0;
  private frozen: FB | null = null;
  private analysis: SceneAnalysis | null = null;
  private t = 0;
  private monster: Monster | null = null;
  private name = '';
  private hp = 0;
  private swatches: number[] = [];
  private revealSound = false;

  constructor(private app: App, private boss: boolean, private toddler = false) {}

  private back(): void {
    sfx.play('back');
    this.app.go(this.toddler ? new TitleScene(this.app) : new MapScene(this.app));
  }

  enter(): void {
    sfx.setMusic('map');
    const app = this.app;
    if (app.camState === 'on' && app.cam) this.mode = 'live';
    else if (app.camState === 'denied' || app.camState === 'unavailable') this.mode = 'fallback';
  }

  leave(): void {
    this.app.closeCamera();
  }

  private theme() {
    const run = this.app.save.run;
    return (run && currentNode(run)?.theme) || 'meadow';
  }

  private askCamera(): void {
    sfx.unlock();
    sfx.play('select');
    void this.app.openCamera();
  }

  private capture(): void {
    const app = this.app;
    const cam = app.cam;
    if (!cam) return;
    const g = grabFrame(cam, app.W, app.H, true);
    if (!g) return;
    this.frozen = g.fb;
    this.analysis = g.analysis;
    sfx.play('shutter');
    app.fx.flash(C.snow, 0.25);
    app.closeCamera();
    this.begin();
  }

  private summonWithoutCamera(): void {
    const app = this.app;
    sfx.unlock();
    sfx.play('select');
    this.frozen = backdrop(app, this.theme(), 40 + (app.save.run?.idx ?? 0)).clone();
    // a made-up "scene" so the monster still gets a colour family
    const ramps: RampName[] = ['fire', 'berry', 'leaf', 'water', 'sky', 'sun', 'plum', 'ghost', 'night'];
    const rgba = new Uint8ClampedArray(4);
    const analysis = analyzeScene(rgba, 1, 1);
    const pick = app.rng.pick(ramps);
    for (const r of ramps) analysis.weights[r] = r === pick ? 0.7 : 0.3 / (ramps.length - 1);
    analysis.hash = app.rng.int(1, 2 ** 30);
    this.analysis = analysis;
    this.begin();
  }

  private begin(): void {
    const app = this.app;
    const a = this.analysis!;
    const f = this.frozen!;
    // the three palette colours that dominate the photo — shown as chips during the scan
    const hist = new Array<number>(16).fill(0);
    for (let i = 0; i < f.px.length; i += 3) hist[f.px[i]] += 1;
    this.swatches = hist
      .map((n, c) => ({ n, c }))
      .sort((x, y) => y.n - x.n)
      .slice(0, 4)
      .map((e) => e.c);

    const ramp = pickRamp(a, app.rng);
    const seed = (a.hash ^ (Date.now() & 0xffffff)) >>> 0;
    const spec = randomSpec(seed, ramp, this.boss);
    this.monster = generateMonster(spec);
    this.name = monsterName(ramp, spec.kind, this.boss);
    const run = app.save.run;
    this.hp = monsterHp(app.save.players, run?.idx ?? 0, this.boss);
    this.mode = 'scan';
    this.t = 0;
    sfx.play('scan');
  }

  update(dt: number): void {
    const app = this.app;
    if (this.mode === 'ask' && app.camState === 'on') this.mode = 'live';
    if (this.mode === 'ask' && (app.camState === 'denied' || app.camState === 'unavailable')) this.mode = 'fallback';

    if (this.mode === 'live' && app.cam) {
      this.lastGrab += dt;
      if (this.lastGrab > 0.08) {
        this.lastGrab = 0;
        const g = grabFrame(app.cam, app.W, app.H, false);
        if (g) this.live = g.fb;
      }
    }
    if (this.mode === 'scan') {
      this.t += dt;
      if (this.t >= 1.5) {
        this.mode = 'reveal';
        this.t = 0;
      }
    } else if (this.mode === 'reveal') {
      this.t += dt;
      if (!this.revealSound && this.t > 0.15) {
        this.revealSound = true;
        sfx.play(this.boss ? 'boss' : 'appear');
        if (this.boss) app.fx.flash(C.berry, 0.5);
        const m = this.monster!;
        const gy = this.groundY();
        app.fx.burst(app.W / 2, gy - m.size / 2, 24, RAMPS[m.spec.ramp] as unknown as number[], 70, 60, 0.9);
      }
    }
  }

  private groundY(): number {
    return Math.round(this.app.H * 0.5);
  }

  /** Toddler mode: straight to the tapping game, no battle. */
  private play(): void {
    const app = this.app;
    if (!this.monster || !this.frozen) return;
    sfx.play('select');
    const bg = this.frozen.clone();
    bg.veil(0, 0, bg.w, bg.h, C.ink, 5);
    app.go(new ToddlerScene(app, bg, this.monster.spec));
  }

  private fight(): void {
    if (this.toddler) {
      this.play();
      return;
    }
    const app = this.app;
    const run = app.save.run;
    if (!this.monster || !this.frozen || !run) return;
    sfx.play('select');
    const bg = this.frozen.clone();
    bg.veil(0, 0, bg.w, bg.h, C.ink, 5);
    vignette(bg, 0.9);
    app.go(new BattleScene(app, {
      bg,
      monster: this.monster,
      name: this.name,
      hp: this.hp,
      boss: this.boss,
      nodeIdx: run.idx,
    }));
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;

    if (this.mode === 'ask' || this.mode === 'fallback') {
      fb.copyFrom(backdrop(app, this.theme(), 77));
      fb.veil(0, 0, W, H, C.ink, 7);
      banner(app, this.boss ? 'BOSS AHEAD!' : 'A MONSTER IS NEAR…', 40, this.boss ? C.berry : C.sun, 1);
      if (this.mode === 'ask') {
        drawText(fb, '用鏡頭掃描身邊的東西，怪物會從那裡跑出來！', W / 2, 70, C.snow, { align: 'center', outline: C.ink, wrapW: W - 28 });
        const starting = app.camState === 'starting';
        app.ui.button(fb, 20, H - 92, W - 40, 24, starting ? 'WAITING…' : 'OPEN CAMERA', BTN.primary, () => this.askCamera(), { disabled: starting });
        app.ui.button(fb, 20, H - 62, W - 40, 20, 'NO CAMERA', BTN.gray, () => this.summonWithoutCamera());
      } else {
        const why = app.camState === 'denied' ? '鏡頭被擋住了，\n我們從地城裡召喚吧！' : '找不到鏡頭，\n我們從地城裡召喚吧！';
        drawText(fb, why, W / 2, 70, C.snow, { align: 'center', outline: C.ink });
        app.ui.button(fb, 20, H - 62, W - 40, 24, 'SUMMON!', BTN.primary, () => this.summonWithoutCamera());
      }
      app.ui.button(fb, 6, H - 28, 30, 14, 'BACK', BTN.dark, () => {
        this.back();
      });
      partyRow(app, 112, -1);
      return;
    }

    if (this.mode === 'live') {
      if (this.live) fb.copyFrom(this.live);
      else fb.clear(C.dusk);
      // scanlines + vignette so it reads as a viewfinder
      for (let y = 0; y < H; y += 3) fb.veil(0, y, W, 1, C.ink, 3);
      vignette(fb, 0.6);
      // moving scan bar
      const by = Math.round(((app.t * 0.5) % 1) * H);
      fb.veil(0, by, W, 2, C.ice, 12);
      // corner brackets
      const L = 14;
      const bracket = (x: number, y: number, dx: number, dy: number) => {
        fb.rect(dx > 0 ? x : x - L + 1, y, L, 1, C.snow);
        fb.rect(x, dy > 0 ? y : y - L + 1, 1, L, C.snow);
      };
      bracket(14, 36, 1, 1);
      bracket(W - 15, 36, -1, 1);
      bracket(14, H - 84, 1, -1);
      bracket(W - 15, H - 84, -1, -1);
      banner(app, this.boss ? 'FIND THE BOSS!' : 'POINT & SCAN!', 12, this.boss ? C.berry : C.sun, 1);
      // shutter
      const cx = W / 2;
      const cy = H - 38;
      const pressed = app.ui.isPressed(cx - 20, cy - 20, 40, 40);
      fb.disc(cx, cy, 21, C.ink);
      fb.disc(cx, cy, 19, C.snow);
      fb.disc(cx, cy + (pressed ? 1 : 0), 15, pressed ? C.orange : C.sun);
      fb.ring(cx, cy, 15, C.orange);
      drawText(fb, 'SCAN', cx, cy - 7 + (pressed ? 1 : 0), C.ink, { align: 'center' });
      app.ui.zone(cx - 22, cy - 22, 44, 44, () => this.capture(), 'shutter');
      app.ui.button(fb, 6, H - 22, 30, 14, 'BACK', BTN.dark, () => {
        this.back();
      });
      return;
    }

    // ---- scan + reveal: frozen frame, darkening as the "analysis" runs
    const frozen = this.frozen!;
    fb.copyFrom(frozen);
    const monster = this.monster!;
    const gy = this.groundY();
    if (this.mode === 'scan') {
      const p = Math.min(1, this.t / 1.4);
      const beam = Math.round(p * H);
      fb.veil(0, 0, W, beam, C.ink, 5);
      fb.rect(0, beam, W, 1, C.ice);
      fb.veil(0, beam + 1, W, 4, C.ice, 8);
      drawText(fb, 'ANALYZING…', W / 2, H - 70, C.ice, { align: 'center', outline: C.ink });
      const shown = Math.floor(p * (this.swatches.length + 1));
      this.swatches.forEach((c, i) => {
        if (i >= shown) return;
        const x = Math.round(W / 2 - (this.swatches.length * 14) / 2) + i * 14;
        fb.rect(x - 1, H - 52, 12, 12, C.ink);
        fb.rect(x, H - 51, 10, 10, c);
      });
    } else {
      fb.veil(0, 0, W, H, C.ink, 5);
      vignette(fb, 0.9);
      const p = Math.min(1, this.t / 0.8);
      groundShadow(fb, W / 2, gy + 1, Math.round(monster.size * 0.32 * p));
      const y = gy - monster.groundY + bob(app.t, 1.5, 3);
      fb.blit(monster.frames.idle, Math.round(W / 2 - monster.size / 2), y, { alpha: Math.round(p * 16) });
      if (this.t > 0.5) {
        banner(app, this.toddler ? 'HELLO!' : this.boss ? 'BOSS!' : 'A WILD ONE!', 30, this.boss ? C.berry : C.sun, 2);
        drawText(fb, this.name, W / 2, 30 + 38, C.snow, { align: 'center', outline: C.ink });
        if (!this.toddler) drawText(fb, `HP ${this.hp}`, W / 2, 30 + 54, C.lime, { align: 'center', outline: C.ink });
      }
      if (this.t > 1.0) {
        app.ui.zone(0, 0, W, H, () => this.fight());
        app.ui.button(fb, 20, H - 44, W - 40, 24, this.toddler ? 'PLAY!' : 'FIGHT!', this.boss ? BTN.danger : BTN.primary, () => this.fight());
      }
    }
  }
}
