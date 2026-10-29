import type { App, Scene } from '../core/app';
import { C } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN, avatarSprite, panel } from '../gfx/ui';
import { drawText, measure, wrap } from '../gfx/text';
import { emojiSprite } from '../gfx/emoji';
import { sfx, say, stopSay } from '../audio/sfx';
import { judge } from '../speech/match';
import { knownHearings, learnHearing } from '../speech/learn';
import { logHeard } from '../speech/heardlog';
import { Speaker, type SpeakResult } from '../speech/speaker';
import { LEVELS, type Word } from '../data/words';
import { pickPractice } from '../game/deck';
import { record, summary } from '../game/progress';
import type { Level } from '../game/model';
import { backdrop, bob, levelPips } from './common';
import { micButton, statusLine, typingBox, failMessage } from './speakpanel';
import { TitleScene } from './title';

/**
 * Practice: no monsters, no map, nothing to lose. Words still count towards
 * each player's mastery, so it feeds the real game's card selection.
 */
export class PracticeScene implements Scene {
  readonly id = 'practice';
  private speaker: Speaker;
  private word: Word | null = null;
  private recent: string[] = [];
  private result: 'none' | 'perfect' | 'good' | 'miss' = 'none';
  private heard = '';
  private lastCand: string[] = [];
  private note = '';
  private streak = 0;
  private resultT = 0;
  private forceTyping = false;
  /** per-session level override so a parent can review without touching their saved level */
  private lv: Level;

  constructor(private app: App) {
    this.speaker = new Speaker(app.rec);
    this.lv = app.active.level;
  }

  enter(): void {
    sfx.setMusic('map');
    this.next();
  }

  leave(): void {
    this.speaker.cancel();
    stopSay();
  }

  private next(): void {
    const app = this.app;
    this.word = pickPractice(app.active, this.lv, Date.now(), app.rng, this.recent);
    this.recent = [this.word.id, ...this.recent].slice(0, 10);
    this.result = 'none';
    this.heard = '';
    this.note = '';
    this.speaker.cancel();
  }

  private mic(): void {
    sfx.unlock();
    stopSay();
    sfx.play('listen');
    const cb = (r: SpeakResult) => this.onResult(r);
    if (this.speaker.supported && !this.forceTyping) this.speaker.listen(cb, this.word ? [this.word.w] : []);
    else this.speaker.openTyping(cb);
  }

  private toggleTyping(): void {
    sfx.unlock();
    sfx.play('tap');
    stopSay();
    if (this.speaker.mode === 'typing') {
      this.speaker.cancel();
      this.forceTyping = false;
    } else {
      this.forceTyping = true;
      this.speaker.openTyping((r) => this.onResult(r));
    }
  }

  private onResult(r: SpeakResult): void {
    const w = this.word;
    if (!w) return;
    let cand: string[];
    if (r.kind === 'heard') cand = r.candidates;
    else if (r.kind === 'typed') cand = [r.text];
    else {
      if (r.reason === 'denied' || r.reason === 'unsupported') this.forceTyping = true;
      this.note = failMessage(r.reason);
      return;
    }
    const app = this.app;
    const j = judge(w.w, cand, this.lv, knownHearings(app.save.aliases, w));
    this.lastCand = cand;
    logHeard({ w: w.w, c: cand, r: j.tier, lv: this.lv });
    this.heard = j.heard;
    this.result = j.tier;
    this.resultT = 0;
    const p = app.active;
    const updated = { ...p, progress: record(p.progress, w.id, j.tier !== 'miss', Date.now()) };
    app.save = { ...app.save, players: app.save.players.map((q) => (q.id === p.id ? updated : q)) };
    app.persist();
    if (j.tier === 'miss') {
      this.streak = 0;
      sfx.play('miss');
      say(w.w);
    } else {
      this.streak += 1;
      sfx.play(j.tier === 'perfect' ? 'perfect' : 'good');
      app.fx.burst(app.W / 2, 110, 16, [C.sun, C.snow, C.ice, C.lime], 70, 60, 0.7);
    }
  }

  /** A grown-up heard it right although the engine did not. */
  private confirm(w: Word): void {
    const app = this.app;
    const p = app.active;
    const updated = { ...p, progress: record(p.progress, w.id, true, Date.now()) };
    app.save = {
      ...app.save,
      aliases: learnHearing(app.save.aliases, w, this.lastCand),
      players: app.save.players.map((q) => (q.id === p.id ? updated : q)),
    };
    app.persist();
    logHeard({ w: w.w, c: this.lastCand, r: 'confirmed', lv: this.lv });
    this.result = 'good';
    this.resultT = 0;
    this.streak += 1;
    sfx.play('good');
    app.fx.burst(app.W / 2, 110, 16, [C.sun, C.snow, C.ice, C.lime], 70, 60, 0.7);
  }

  private cycleActive(): void {
    const app = this.app;
    const n = app.save.players.length;
    if (n < 2) return;
    app.save = { ...app.save, active: (app.save.active + 1) % n };
    app.persist();
    this.lv = app.active.level;
    this.streak = 0;
    sfx.play('tap');
    this.next();
  }

  update(dt: number): void {
    this.resultT += dt;
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.speaker.submitTyping();
  }

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W, H } = app;
    const w = this.word;
    fb.copyFrom(backdrop(app, 'meadow', 5));
    fb.veil(0, 0, W, H, C.ink, 9);

    app.ui.button(fb, 6, 6, 34, 15, 'BACK', BTN.dark, () => {
      sfx.play('back');
      app.go(new TitleScene(app));
    });
    drawText(fb, 'PRACTICE', W / 2 + 10, 6, C.sun, { align: 'center', outline: C.ink });

    // who + level
    const p = app.active;
    const sp = avatarSprite(p.face);
    fb.blit(sp, 8, 28, { alpha: 16 });
    app.ui.zone(4, 24, 90, 32, () => this.cycleActive());
    drawText(fb, p.name, 8 + sp.w + 4, 28, C.snow, { outline: C.ink });
    drawText(fb, app.save.players.length > 1 ? '點我換人' : '', 8 + sp.w + 4, 42, C.slate);
    app.ui.button(fb, W - 88, 28, 16, 15, '', BTN.gray, () => this.changeLv(-1), { icon: ICON.arrowL, disabled: this.lv <= 1, name: 'level-' });
    app.ui.button(fb, W - 22, 28, 16, 15, '', BTN.gray, () => this.changeLv(1), { icon: ICON.arrowR, disabled: this.lv >= 4, name: 'level+' });
    drawText(fb, LEVELS[this.lv - 1].name, W - 55, 29, C.sun, { align: 'center' });
    levelPips(fb, W - 62, 45, this.lv);

    const s = summary(p.progress, Date.now());
    drawText(fb, `已學 ${s.seen}   熟練 ${s.mastered}`, W / 2, 62, C.mist, { align: 'center' });
    if (this.streak >= 2) drawText(fb, `${this.streak} in a row!`, W / 2, 76, C.sun, { align: 'center', outline: C.ink });

    if (!w) return;

    // big card
    const cx = Math.round(W / 2 - 40);
    panel(fb, cx, 92, 80, 80, C.navy, C.slate);
    if (w.icon) {
      const e = emojiSprite(w.icon, 56);
      fb.blit(e, Math.round(W / 2 - e.w / 2), 92 + Math.round((80 - e.h) / 2) + Math.round(bob(app.t, 1.5, 3)));
    } else {
      const lines = wrap(w.zh, 70);
      lines.slice(0, 3).forEach((ln, i) => drawText(fb, ln, W / 2, 110 + i * 14 - (lines.length - 1) * 7, C.sun, { align: 'center' }));
    }
    const big = measure(w.w, 2) <= W - 16;
    if (big) drawText(fb, w.w, W / 2, 180, C.snow, { align: 'center', scale: 2, outline: C.ink });
    else drawText(fb, w.w, W / 2, 186, C.snow, { align: 'center', outline: C.ink });
    if (this.lv > 1 || !w.icon) drawText(fb, w.zh, W / 2, 208, C.ice, { align: 'center', outline: C.ink });

    // result / status
    const by = H - 98;
    if (this.result !== 'none') {
      const msg = this.result === 'perfect' ? 'PERFECT!' : this.result === 'good' ? 'GOOD!' : 'Not quite…';
      const col = this.result === 'perfect' ? C.sun : this.result === 'good' ? C.ice : C.orange;
      const pop = this.result === 'miss' ? 0 : Math.max(0, 3 - Math.floor(this.resultT * 14));
      drawText(fb, msg, W / 2, by - 6 - pop, col, { align: 'center', scale: 2, outline: C.ink, pixel: true });
      if (this.result === 'miss') drawText(fb, `I heard “${this.heard || '…'}”`, W / 2, by + 16, C.mist, { align: 'center', outline: C.ink });
      app.ui.button(fb, 20, H - 40, W - 40, 24, 'NEXT', BTN.primary, () => {
        sfx.play('select');
        this.next();
      });
      app.ui.button(fb, W - 34, H - 72, 26, 20, '', BTN.blue, () => { sfx.unlock(); say(w.w); }, { icon: ICON.speaker, name: 'hear' });
      if (this.result === 'miss') {
        app.ui.button(fb, W - 66, H - 72, 28, 20, '', BTN.green, () => this.confirm(w), { icon: ICON.check, name: 'confirm' });
        app.ui.button(fb, 8, H - 72, 60, 20, 'RETRY', BTN.green, () => {
          sfx.play('tap');
          this.result = 'none';
          this.heard = '';
        });
      }
      return;
    }

    if (this.speaker.mode === 'typing') {
      typingBox(app, this.speaker, H - 84, () => this.speaker.submitTyping());
    } else {
      if (this.note && !this.speaker.listening) {
        this.note.split('\n').slice(0, 3).forEach((ln, i) => drawText(fb, ln, W / 2, H - 118 + i * 13, C.orange, { align: 'center', outline: C.ink }));
      } else {
        statusLine(app, this.speaker, H - 100, 'Tap the mic and say it!');
      }
      micButton(app, Math.round(W / 2), H - 54, this.speaker, () => this.mic(), 18);
    }
    app.ui.button(fb, W - 34, H - 68, 26, 20, '', BTN.blue, () => { sfx.unlock(); sfx.play('tap'); say(w.w); }, { icon: ICON.speaker, name: 'hear' });
    app.ui.button(fb, 8, H - 68, 26, 20, '', BTN.gray, () => this.toggleTyping(), { icon: ICON.kbd, name: 'keyboard' });
  }

  private changeLv(d: number): void {
    const lv = Math.max(1, Math.min(4, this.lv + d)) as Level;
    if (lv === this.lv) return;
    this.lv = lv;
    sfx.play('tap');
    this.next();
  }
}
