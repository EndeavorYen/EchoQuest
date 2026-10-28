import type { App, Scene } from '../core/app';
import type { FB } from '../gfx/fb';
import { C, RAMPS, type PalIndex } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN, avatarSprite, bar, faceTint, panel } from '../gfx/ui';
import { drawText, measure, wrap } from '../gfx/text';
import { emojiSprite } from '../gfx/emoji';
import type { Monster, FrameName } from '../gfx/monster';
import { sfx, say, stopSay } from '../audio/sfx';
import { judge, type Tier } from '../speech/match';
import { Speaker, type SpeakResult } from '../speech/speaker';
import { Battle, attackName, type MonsterState } from '../game/battle';
import { dealCard, pickDefenseWord, type Card } from '../game/deck';
import { record } from '../game/progress';
import { Revenge, REVENGE_MULT } from '../game/revenge';
import { advance } from '../game/run';
import type { Word } from '../data/words';
import { bob, groundShadow, levelPips } from './common';
import { micButton, statusLine, typingBox, failMessage } from './speakpanel';
import { MapScene } from './map';
import { MAX_PLAYERS, newPlayer, type Level } from '../game/model';
import { LEVELS } from '../data/words';

export interface BattleInit {
  bg: FB;
  monster: Monster;
  name: string;
  hp: number;
  boss: boolean;
  nodeIdx: number;
}

type Phase = 'intro' | 'speak' | 'strike' | 'defend' | 'resolve' | 'victory';

interface Proj {
  x0: number; y0: number; x1: number; y1: number;
  t: number; dur: number; color: PalIndex; arc: number; big: boolean;
  onHit: () => void;
}

const PANEL_H = 142;

/** Seconds a defender gets, by level. Little kids get no clock at all. */
const DEFENSE_TIME: Record<number, number> = { 1: 0, 2: 8, 3: 7, 4: 6 };

const LEVEL_COLOR: Record<number, PalIndex> = { 1: C.lime, 2: C.sun, 3: C.ice, 4: C.orange };

export class BattleScene implements Scene {
  readonly id = 'battle';
  private b: Battle;
  private speaker: Speaker;
  private phase: Phase = 'intro';
  private pt = 0;
  private sel: Card | null = null;
  private tries = 0;
  private note = '';
  private recent: string[] = [];
  private revenge = new Revenge();
  /** The party panel (add players, change levels) is open; the battle clock is paused. */
  private manage = false;
  private manageLevel = 1;
  /** The current spell is a word the player missed earlier in this battle. */
  private isRevenge = false;
  private used = new Map<string, Word>();
  private shownHp: number;
  private chipHp: number;
  private proj: Proj | null = null;
  private hurtT = 0;
  private openT = 0;
  private blinkT = 0;
  private nextBlink = 2;
  private flashT = 0;
  private after = 0;
  private afterFn: (() => void) | null = null;
  private defWord: Word | null = null;
  private defLimit = 0;
  private defLeft = 0;
  private attackLabel = '';
  private forceTyping = false;
  private dissolve = 0;
  private lootGiven = false;
  private heroShield = 0;
  private heroHurt = 0;
  private heroCast = 0;

  constructor(private app: App, private init: BattleInit) {
    const ms: MonsterState = { name: init.name, hp: init.hp, maxHp: init.hp, boss: init.boss };
    const n = app.save.players.length;
    this.b = new Battle(ms, app.save.players, app.save.active % n);
    this.speaker = new Speaker(app.rec);
    this.shownHp = init.hp;
    this.chipHp = init.hp;
    this.attackLabel = attackName(init.monster.spec.ramp);
  }

  enter(): void {
    sfx.setMusic('battle');
  }

  leave(): void {
    this.speaker.cancel();
    stopSay();
  }

  // ---- geometry ----------------------------------------------------------

  private get panelY(): number {
    return this.app.H - PANEL_H;
  }

  private get groundY(): number {
    const avail = this.panelY - 34;
    return Math.max(this.init.boss ? 112 : 88, Math.round(avail * 0.78));
  }

  private get monsterX(): number {
    return this.app.W / 2;
  }

  private heroPos(i: number): { x: number; y: number } {
    const n = this.app.save.players.length;
    const slot = Math.min(40, Math.floor((this.app.W - 16) / n));
    const x0 = Math.round((this.app.W - n * slot) / 2);
    return { x: x0 + i * slot + Math.round(slot / 2), y: this.groundY + 32 };
  }

  // ---- flow --------------------------------------------------------------

  /** Deal the selected player a word at their own difficulty. */
  private dealSpell(): void {
    const att = this.b.attacker;
    const back = this.revenge.take(att.id, this.b.round);
    this.isRevenge = back !== null;
    this.sel = back ? { word: back } : dealCard(att, Date.now(), this.app.rng, this.recent);
    this.tries = 0;
    this.note = '';
    this.speaker.cancel();
    this.phase = 'speak';
    this.pt = 0;
    say(this.sel.word.w);
  }

  /** One tap on an avatar: that player is up. Mid-spell or mid-shield, the word and the shield clock start over. */
  private selectPlayer(i: number): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    sfx.unlock();
    this.speaker.cancel();
    stopSay();
    if (i === this.b.turn) {
      sfx.play('tap');
      const w = this.phase === 'speak' ? this.sel?.word : this.defWord;
      if (w) say(w.w);
      return;
    }
    sfx.play('select');
    // a revenge word that was waiting on the table goes back in line for its player
    if (this.phase === 'speak' && this.isRevenge && this.sel) this.revenge.miss(this.b.attacker.id, this.sel.word, this.b.round, 0);
    this.b.select(i);
    const app = this.app;
    app.save = { ...app.save, active: i };
    app.persist();
    this.heroCast = 0.3;
    if (this.phase === 'speak') this.dealSpell();
    else this.dealShield(false);
  }

  // ---- party management (any time, even mid-battle) -----------------------

  private openManage(): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    sfx.unlock();
    sfx.play('tap');
    this.speaker.cancel();
    stopSay();
    this.manage = true;
    this.manageLevel = this.b.attacker.level;
  }

  private closeManage(): void {
    sfx.play('select');
    this.manage = false;
    // a changed level means a different word; the shield clock always starts fresh
    if (this.phase === 'speak') {
      if (this.b.attacker.level !== this.manageLevel) this.dealSpell();
      else if (this.sel) say(this.sel.word.w);
    } else if (this.phase === 'defend') this.dealShield(false);
  }

  private setLevel(i: number, delta: number): void {
    const p = this.app.save.players[i];
    const lv = Math.max(1, Math.min(4, p.level + delta)) as Level;
    if (lv === p.level) return;
    p.level = lv; // in place: the battle holds these same player objects
    this.app.persist();
    sfx.play('tap');
  }

  private addPlayer(): void {
    const app = this.app;
    if (app.save.players.length >= MAX_PLAYERS) return;
    const np = newPlayer(app.save.players.length, 1); // a fresh start: blank progress
    app.save = { ...app.save, players: [...app.save.players, np] };
    this.b.players = app.save.players;
    app.persist();
    sfx.play('select');
  }

  private drawManage(): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    fb.veil(0, 0, W, app.H, C.ink, 13);
    const n = app.save.players.length;
    panel(fb, 4, 36, W - 8, 62 - 36 + n * 30 + (n < MAX_PLAYERS ? 24 : 0) + 22 + 8, C.dusk, C.slate);
    drawText(fb, 'PARTY', W / 2, 41, C.sun, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    const players = app.save.players;
    players.forEach((p, i) => {
      const y = 62 + i * 30;
      fb.rect(10, y, W - 20, 27, C.navy);
      fb.frame(10, y, W - 20, 27, C.ink);
      fb.blit(avatarSprite(p.face), 14, y + 5, { scale: 1 });
      drawText(fb, p.name, 32, y + 3, C.snow);
      drawText(fb, `Lv.${p.level} ${LEVELS[p.level - 1].name}`, 32, y + 15, C.sun);
      app.ui.button(fb, W - 54, y + 5, 18, 17, '', BTN.gray, () => this.setLevel(i, -1), { icon: ICON.arrowL, disabled: p.level <= 1, name: `level-${i}` });
      app.ui.button(fb, W - 32, y + 5, 18, 17, '', BTN.gray, () => this.setLevel(i, 1), { icon: ICON.arrowR, disabled: p.level >= 4, name: `level+${i}` });
    });
    let by = 62 + players.length * 30 + 2;
    if (players.length < MAX_PLAYERS) {
      app.ui.button(fb, 10, by, W - 20, 20, '+ ADD PLAYER', BTN.green, () => this.addPlayer());
      by += 24;
    }
    app.ui.button(fb, 10, by, W - 20, 22, 'DONE', BTN.primary, () => this.closeManage());
  }

  private mic(): void {
    sfx.unlock();
    stopSay();
    sfx.play('listen');
    const cb = (r: SpeakResult) => (this.phase === 'speak' ? this.onSpoken(r) : this.onDefended(r));
    if (this.speaker.supported && !this.forceTyping) this.speaker.listen(cb);
    else this.speaker.openTyping(cb);
  }

  private toggleTyping(): void {
    sfx.unlock();
    stopSay();
    sfx.play('tap');
    const cb = (r: SpeakResult) => (this.phase === 'speak' ? this.onSpoken(r) : this.onDefended(r));
    if (this.speaker.mode === 'typing') {
      this.speaker.cancel();
      this.forceTyping = false;
    } else {
      this.forceTyping = true;
      this.speaker.openTyping(cb);
    }
  }

  private candidates(r: SpeakResult): string[] | null {
    if (r.kind === 'heard') return r.candidates;
    if (r.kind === 'typed') return [r.text];
    if (r.reason === 'denied' || r.reason === 'unsupported') {
      this.forceTyping = true;
      this.note = failMessage(r.reason);
    } else if (r.reason === 'no-speech') {
      this.note = failMessage(r.reason);
    }
    return null;
  }

  private onSpoken(r: SpeakResult): void {
    const cand = this.candidates(r);
    const card = this.sel;
    if (!cand || !card) return;
    const att = this.b.attacker;
    const j = judge(card.word.w, cand, att.level);
    if (j.tier !== 'miss') {
      att.progress = record(att.progress, card.word.id, true, Date.now());
      this.strike(card, j.tier, this.isRevenge);
      return;
    }
    this.tries += 1;
    if (this.tries >= 2) {
      att.progress = record(att.progress, card.word.id, false, Date.now());
      this.revenge.miss(att.id, card.word, this.b.round);
      this.fizzle(card);
    } else {
      this.note = `I heard “${j.heard || '…'}”.\nListen and try again!`;
      sfx.play('miss');
      say(card.word.w);
    }
  }

  private strike(card: Card, tier: Tier, revenge = false): void {
    const app = this.app;
    const att = this.b.attacker;
    this.phase = 'strike';
    this.pt = 0;
    this.speaker.cancel();
    this.recent = [card.word.id, ...this.recent].slice(0, 8);
    this.used.set(card.word.id, card.word);
    const hero = this.heroPos(this.b.turn);
    const lv = card.word.lv;
    this.heroCast = 0.35;
    sfx.play(tier === 'perfect' ? 'perfect' : 'good');
    this.proj = {
      x0: hero.x, y0: hero.y - 10,
      x1: this.monsterX, y1: this.groundY - this.init.monster.size * 0.45,
      t: 0, dur: 0.42, color: LEVEL_COLOR[lv] ?? C.sun, arc: 26, big: tier === 'perfect',
      onHit: () => {
        const res = this.b.attack(card.word, tier, revenge ? REVENGE_MULT : 1);
        att.stats.dealt += res.damage;
        att.stats.words += 1;
        if (tier === 'perfect') att.stats.perfect += 1;
        this.impact(res.damage, lv, tier);
        if (revenge) app.fx.float(this.monsterX, this.groundY - this.init.monster.size - 60, 'REVENGE!', C.berry, 2);
        if (res.combo >= 2) {
          app.fx.float(this.monsterX, this.groundY - this.init.monster.size - 32, `COMBO x${res.combo}`, C.sun, 1);
          sfx.play('combo', res.combo);
        }
        if (res.held) {
          app.fx.float(this.monsterX, this.groundY - this.init.monster.size - 46, `Needs ${res.waitingFor[0]}!`, C.ice, 1);
        }
        this.defer(res.killed ? 0.7 : 0.9, () => (res.killed ? this.victory() : this.startDefense()));
      },
    };
  }

  private fizzle(card: Card): void {
    this.phase = 'strike';
    this.pt = 0;
    this.speaker.cancel();
    this.b.fizzle();
    this.recent = [card.word.id, ...this.recent].slice(0, 8);
    const hero = this.heroPos(this.b.turn);
    sfx.play('miss');
    this.app.fx.burst(hero.x, hero.y - 6, 8, [C.mist, C.slate], 30, 40, 0.5);
    this.app.fx.float(hero.x, hero.y - 22, 'Good try!', C.mist, 1);
    say(card.word.w);
    this.defer(1.2, () => this.startDefense());
  }

  private impact(damage: number, lv: number, tier: Tier): void {
    const app = this.app;
    const m = this.init.monster;
    const cx = this.monsterX;
    const cy = this.groundY - m.size * 0.5;
    sfx.play('hit', lv);
    app.fx.hitstop(0.05 + lv * 0.02);
    app.fx.shake(1 + lv, 0.28);
    app.fx.burst(cx, cy, 10 + lv * 6, [...RAMPS[m.spec.ramp], C.snow] as PalIndex[], 70 + lv * 10, 110, 0.7);
    app.fx.ring(cx, cy, LEVEL_COLOR[lv] ?? C.sun);
    app.fx.float(cx, this.groundY - m.size - 4, `-${damage}`, tier === 'perfect' ? C.sun : C.ice, 2, C.berry);
    app.fx.float(cx, this.groundY - m.size - 18, tier === 'perfect' ? 'PERFECT!' : 'GOOD', tier === 'perfect' ? C.sun : C.ice, 1);
    this.hurtT = 0.45;
    this.flashT = 0.07;
  }

  private startDefense(): void {
    this.phase = 'defend';
    this.pt = 0;
    this.openT = 99;
    sfx.play('warn');
    this.app.fx.flash(C.berry, 0.2);
    this.dealShield(true);
  }

  /** Give whoever is selected a shield word; their clock (if their level has one) starts fresh. */
  private dealShield(first: boolean): void {
    const def = this.b.defender;
    this.defWord = pickDefenseWord(def, Date.now(), this.app.rng, this.recent);
    this.recent = [this.defWord.id, ...this.recent].slice(0, 8);
    this.defLimit = DEFENSE_TIME[def.level] ?? 0;
    this.defLeft = this.defLimit;
    this.tries = 0;
    this.note = '';
    this.speaker.cancel();
    say(this.defWord.w, 0.9);
    void first;
  }

  private onDefended(r: SpeakResult): void {
    const cand = this.candidates(r);
    const w = this.defWord;
    if (!cand || !w) return;
    const def = this.b.defender;
    const j = judge(w.w, cand, def.level);
    if (j.tier !== 'miss') {
      def.progress = record(def.progress, w.id, true, Date.now());
      this.resolveDefense(true);
      return;
    }
    this.tries += 1;
    if (this.tries >= 2) {
      def.progress = record(def.progress, w.id, false, Date.now());
      this.resolveDefense(false);
    } else {
      this.note = `I heard “${j.heard || '…'}”.\nQuick, once more!`;
      sfx.play('miss');
    }
  }

  private resolveDefense(blocked: boolean): void {
    const app = this.app;
    this.phase = 'resolve';
    this.pt = 0;
    this.speaker.cancel();
    const m = this.init.monster;
    const hero = this.heroPos(this.b.turn);
    sfx.play('monsterAttack');
    this.openT = 0.5;
    this.proj = {
      x0: this.monsterX, y0: this.groundY - m.size * 0.45,
      x1: hero.x, y1: hero.y - 4,
      t: 0, dur: 0.5, color: RAMPS[m.spec.ramp][1] as PalIndex, arc: -10, big: true,
      onHit: () => {
        const res = this.b.defend(blocked);
        if (blocked) {
          this.b.defender.stats.blocks += 1;
          this.heroShield = 0.7;
          sfx.play('block');
          app.fx.ring(hero.x, hero.y - 6, C.ice, 90, 0.4);
          app.fx.burst(hero.x, hero.y - 6, 14, [C.ice, C.snow, C.sky], 60, 40, 0.5);
          app.fx.shake(2, 0.2);
          app.fx.float(hero.x, hero.y - 26, 'BLOCKED!', C.ice, 1);
          // the blow bounces back
          this.proj = {
            x0: hero.x, y0: hero.y - 6, x1: this.monsterX, y1: this.groundY - m.size * 0.45,
            t: 0, dur: 0.4, color: C.ice, arc: 22, big: false,
            onHit: () => {
              this.impact(res.reflect, 1, 'good');
              this.defer(res.killed ? 0.7 : 0.7, () => (res.killed ? this.victory() : this.nextRound()));
            },
          };
        } else {
          this.heroHurt = 0.5;
          sfx.play('hurt');
          app.fx.shake(4, 0.35);
          app.fx.flash(C.berry, 0.25);
          app.fx.burst(hero.x, hero.y - 6, 12, [C.berry, C.orange, C.snow], 55, 70, 0.6);
          app.fx.float(hero.x, hero.y - 26, 'OUCH!', C.orange, 1);
          if (res.healed > 0) {
            app.fx.float(this.monsterX, this.groundY - m.size - 6, `+${res.healed}`, C.lime, 1);
            sfx.play('heal');
          }
          this.defer(1.0, () => this.nextRound());
        }
      },
    };
  }

  private nextRound(): void {
    this.b.nextRound();
    this.openT = 0;
    this.dealSpell();
  }

  private victory(): void {
    this.phase = 'victory';
    this.pt = 0;
    this.dissolve = 0;
    this.speaker.cancel();
    sfx.setMusic(null);
    sfx.play('win');
    const app = this.app;
    app.fx.flash(C.snow, 0.3);
    const m = this.init.monster;
    app.fx.burst(this.monsterX, this.groundY - m.size / 2, 40, [C.sun, C.snow, C.ice, C.lime, C.orange], 100, 80, 1.2);
    if (!this.lootGiven) {
      this.lootGiven = true;
      const have = new Set(app.save.collection);
      for (const id of this.used.keys()) have.add(id);
      app.save = { ...app.save, collection: [...have], active: this.b.turn };
      app.persist();
    }
  }

  private defer(sec: number, fn: () => void): void {
    this.after = sec;
    this.afterFn = fn;
  }

  private leaveBattle(): void {
    const app = this.app;
    const run = app.save.run;
    if (!run) return;
    const from = run.idx;
    app.save = { ...app.save, run: advance(run) };
    app.persist();
    sfx.setMusic('map');
    app.go(new MapScene(app, from));
  }

  // ---- update ------------------------------------------------------------

  update(dt: number): void {
    this.pt += dt;
    const m = this.init.monster;
    void m;
    // monster blink
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.12;
      this.nextBlink = 2 + this.app.rng.next() * 3;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.heroShield > 0) this.heroShield -= dt;
    if (this.heroHurt > 0) this.heroHurt -= dt;
    if (this.heroCast > 0) this.heroCast -= dt;
    if (this.openT > 0 && this.openT < 90) this.openT -= dt;

    // health bars chase the real value
    const hp = this.b.monster.hp;
    if (this.shownHp > hp) this.shownHp = Math.max(hp, this.shownHp - 120 * dt);
    else if (this.shownHp < hp) this.shownHp = Math.min(hp, this.shownHp + 60 * dt);
    if (this.chipHp > this.shownHp) this.chipHp = Math.max(this.shownHp, this.chipHp - 25 * dt);
    else this.chipHp = this.shownHp;

    if (this.phase === 'intro' && this.pt > 1.1) this.dealSpell();

    if (this.proj) {
      this.proj.t += dt;
      const p = this.proj;
      const k = Math.min(1, p.t / p.dur);
      const x = p.x0 + (p.x1 - p.x0) * k;
      const y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * p.arc;
      if (Math.floor(p.t * 60) !== Math.floor((p.t - dt) * 60)) {
        this.app.fx.burst(x, y, 1, [p.color, C.snow], 14, 0, 0.3);
      }
      if (k >= 1) {
        this.proj = null;
        p.onHit();
      }
    }

    if (this.afterFn) {
      this.after -= dt;
      if (this.after <= 0) {
        const fn = this.afterFn;
        this.afterFn = null;
        fn();
      }
    }

    // defence clock: pauses while the mic is spinning up
    if (this.phase === 'defend' && this.defLimit > 0 && !this.speaker.starting && !this.manage) {
      this.defLeft -= dt;
      if (this.defLeft <= 0) {
        this.defLeft = 0;
        this.resolveDefense(false);
      }
    }
    if (this.phase === 'victory') this.dissolve = Math.min(1, this.pt / 1.0);
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.speaker.submitTyping();
  }

  // ---- drawing -----------------------------------------------------------

  draw(): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    const off = app.fx.offset;
    const m = this.init.monster;
    const gy = this.groundY;
    const mx = this.monsterX;

    // world layer (shakes)
    fb.clear(C.ink);
    fb.copyFrom(this.init.bg, off.x, off.y);

    // monster
    if (!(this.phase === 'victory' && this.dissolve >= 1)) {
      const drop = this.phase === 'intro' ? Math.max(0, Math.round((1 - Math.min(1, this.pt / 0.5)) * -40)) : 0;
      let frame: FrameName = 'idle';
      if (this.hurtT > 0) frame = 'hurt';
      else if (this.openT > 0 || this.phase === 'defend') frame = 'open';
      else if (this.blinkT > 0) frame = 'blink';
      let sw = m.size;
      let sh = m.size;
      let yoff = bob(app.t, 1.5, 3);
      if (this.hurtT > 0) {
        const k = this.hurtT / 0.45;
        sw = Math.round(m.size * (1 + 0.12 * k));
        sh = Math.round(m.size * (1 - 0.12 * k));
      } else if (this.phase === 'defend') {
        yoff += app.rng.int(-1, 1);
        sw = m.size + (Math.floor(app.t * 14) % 2);
      }
      groundShadow(fb, mx + off.x, gy + 1 + off.y, Math.round(m.size * 0.32));
      const x = Math.round(mx - sw / 2) + off.x + (this.phase === 'defend' ? app.rng.int(-1, 1) : 0);
      const y = gy - sh + (m.size - m.groundY) + yoff + drop + off.y - (m.size - m.groundY);
      const alpha = this.phase === 'victory' ? Math.round(16 * (1 - this.dissolve)) : 16;
      fb.blitStretch(m.frames[frame], x, y, sw, sh, {
        tint: this.flashT > 0 ? C.snow : undefined,
        alpha,
      });
      if (this.phase === 'defend') {
        // danger aura
        fb.veil(0, 0, W, this.panelY, C.berry, 2 + (Math.floor(app.t * 6) % 2) * 2);
      }
    }

    // heroes
    const players = app.save.players;
    players.forEach((p, i) => {
      const pos = this.heroPos(i);
      const isAtt = i === this.b.turn && (this.phase === 'speak' || this.phase === 'strike');
      const isDef = i === this.b.turn && (this.phase === 'defend' || this.phase === 'resolve');
      const sp = avatarSprite(p.face);
      const HS = 2;
      let hop = 0;
      if (isAtt) hop = bob(app.t, 1.2, 8) - 1;
      if (i === this.b.turn && this.heroCast > 0) hop = -4;
      const hurt = isDef && this.heroHurt > 0 && Math.floor(app.t * 20) % 2 === 0;
      const x = pos.x - Math.floor((sp.w * HS) / 2) + off.x + (isDef && this.heroHurt > 0 ? app.rng.int(-2, 2) : 0);
      groundShadow(fb, pos.x + off.x, pos.y + 9 + off.y, 10, 2);
      if (!this.manage && (this.phase === 'speak' || this.phase === 'defend')) app.ui.zone(pos.x - 16, pos.y - 20, 32, 36, () => this.selectPlayer(i), 'hero');
      fb.blit(sp, x, pos.y - 16 + hop + off.y, { scale: HS, tint: hurt ? C.snow : undefined, alpha: 16 });
      if (isAtt && !this.manage) {
        fb.blit(ICON.arrowR, pos.x - 2 + off.x, pos.y - 30 + bob(app.t, 1, 6) + off.y, { alpha: 16 });
        drawText(fb, p.name, pos.x + off.x, pos.y + 12, C.snow, { align: 'center', outline: C.ink });
      }
      if (isDef && !this.manage) {
        drawText(fb, p.name, pos.x + off.x, pos.y + 12, C.ice, { align: 'center', outline: C.ink });
      }
      if (isDef && this.heroShield > 0) {
        fb.ring(pos.x + off.x, pos.y - 4 + off.y, 15, C.ice);
        fb.ring(pos.x + off.x, pos.y - 4 + off.y, 14, C.sky);
      }
    });

    // projectile
    if (this.proj) {
      const p = this.proj;
      const k = Math.min(1, p.t / p.dur);
      const x = Math.round(p.x0 + (p.x1 - p.x0) * k);
      const y = Math.round(p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * p.arc);
      const r = p.big ? 4 : 3;
      fb.disc(x, y, r + 1, C.ink);
      fb.disc(x, y, r, p.color);
      fb.set(x - 1, y - 1, C.snow);
      if (Math.floor(app.t * 20) % 2 === 0) fb.ring(x, y, r + 2, p.color);
    }

    app.fx.draw(fb);
    this.drawHud();
    if (this.manage) this.drawManage();
    else this.drawPanel();
  }

  private drawHud(): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    const ms = this.b.monster;
    fb.veil(0, 0, W, 34, C.ink, 12);
    drawText(fb, ms.name, 6, 3, ms.boss ? C.sun : C.snow, { outline: C.ink });
    drawText(fb, `${Math.max(0, Math.ceil(this.shownHp))}/${ms.maxHp}`, W - 26, 3, C.mist, { align: 'right', outline: C.ink });
    if (!this.manage && (this.phase === 'speak' || this.phase === 'defend')) {
      this.app.ui.button(fb, W - 22, 1, 17, 17, '', BTN.gray, () => this.openManage(), { icon: ICON.gear, name: 'party' });
    }
    const bw = W - 12;
    bar(fb, 6, 21, bw, 7, 1, C.dusk, C.dusk);
    bar(fb, 6, 21, bw, 7, this.chipHp / ms.maxHp, C.sun, C.dusk);
    const frac = this.shownHp / ms.maxHp;
    bar(fb, 6, 21, bw, 7, frac, frac > 0.5 ? C.leaf : frac > 0.25 ? C.orange : C.berry, 0, frac > 0.5 ? C.lime : frac > 0.25 ? C.sun : C.orange);
    this.drawChips();
    // combo badge
    if (this.b.combo >= 2) {
      const t = `x${this.b.combo}`;
      drawText(fb, t, W - 6, 72, C.sun, { align: 'right', outline: C.ink, scale: 2, pixel: true });
    }
  }

  /** The fixed row of colour-coded avatars: one tap picks who plays (or who raises the shield). */
  private drawChips(): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    const players = app.save.players;
    const n = players.length;
    const cw = Math.min(40, Math.floor((W - 8 - (n - 1) * 3) / n));
    const ch = 32;
    const x0 = Math.round((W - (n * cw + (n - 1) * 3)) / 2);
    const canTap = !this.manage && (this.phase === 'speak' || this.phase === 'defend');
    players.forEach((p, i) => {
      const x = x0 + i * (cw + 3);
      const y = 37;
      const on = i === this.b.turn;
      const tint = faceTint(p.face);
      const pressed = canTap && app.ui.isPressed(x, y, cw, ch);
      const lift = on ? -2 : 0;
      fb.rect(x, y + lift + 1, cw, ch, C.ink);
      fb.rect(x + 1, y + lift + 2, cw - 2, ch - 2, on ? tint : C.dusk);
      if (!on) fb.rect(x + 1, y + lift + ch - 4, cw - 2, 3, tint);
      if (on) fb.frame(x, y + lift + 1, cw, ch, C.snow);
      const sp = avatarSprite(p.face);
      const ax = x + Math.round((cw - sp.w * 2) / 2);
      fb.blit(sp, ax, y + lift + 4 + (pressed ? 1 : 0), { scale: 2, alpha: on ? 16 : 11 });
      levelPips(fb, x + Math.round((cw - 15) / 2), y + lift + ch - 6, p.level);
      if (canTap) app.ui.zone(x - 1, y - 3, cw + 2, ch + 4, () => this.selectPlayer(i), 'player');
    });
  }

  private drawPanel(): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    const py = this.panelY;
    panel(fb, 2, py, W - 4, PANEL_H - 2, C.dusk, C.slate);

    if (this.phase === 'speak') this.drawSpeak(py);
    else if (this.phase === 'defend') this.drawDefend(py);
    else if (this.phase === 'victory') this.drawVictory(py);
    else if (this.phase === 'strike' || this.phase === 'resolve') {
      const who = this.phase === 'strike' ? this.b.attacker : this.b.defender;
      drawText(fb, this.phase === 'strike' ? `${who.name} casts!` : `${this.attackLabel}!`, W / 2, py + 56, this.phase === 'strike' ? C.sun : C.berry, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    } else if (this.phase === 'intro') {
      drawText(fb, 'Get ready!', W / 2, py + 56, C.sun, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    }
  }

  private wordArt(card: Word, x: number, y: number, size: number): void {
    const fb = this.app.fb;
    fb.rect(x, y, size, size, C.navy);
    fb.frame(x, y, size, size, C.ink);
    if (card.icon) {
      const sp = emojiSprite(card.icon, size - 2);
      fb.blit(sp, x + Math.round((size - sp.w) / 2), y + Math.round((size - sp.h) / 2));
    } else {
      const lines = wrap(card.zh, size - 4);
      const total = lines.length * 14;
      lines.slice(0, 2).forEach((ln, i) => {
        drawText(fb, ln, x + size / 2, y + Math.round((size - total) / 2) + i * 14, C.sun, { align: 'center' });
      });
    }
  }

  private answerBlock(py: number, word: Word, level: number, shield: boolean): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    this.wordArt(word, Math.round(W / 2 - 17), py + 6, 34);
    if (!shield && this.isRevenge) {
      drawText(fb, 'REVENGE!', 8, py + 8, C.berry, { outline: C.snow, pixel: true });
      drawText(fb, 'x1.5', 8, py + 20, C.sun, { outline: C.ink, pixel: true });
    }
    app.ui.zone(Math.round(W / 2 - 60), py + 4, 120, 70, () => { sfx.unlock(); sfx.play('tap'); say(word.w); }, 'word');
    const lv1 = level === 1;
    const big = measure(word.w, 2) <= W - 24;
    const wy = py + 44;
    if (big && (lv1 || word.w.length <= 9)) {
      drawText(fb, word.w, W / 2, wy, C.snow, { align: 'center', scale: 2, outline: C.ink });
    } else {
      drawText(fb, word.w, W / 2, wy + 6, C.snow, { align: 'center', outline: C.ink });
    }
    if (!lv1 || !word.icon) drawText(fb, word.zh, W / 2, wy + 29, C.ice, { align: 'center' });

    const mode = this.speaker.mode;
    if (mode === 'typing') {
      typingBox(app, this.speaker, py + 90, () => this.speaker.submitTyping());
    } else {
      const lines = (this.note || '').split('\n');
      if (this.note && !this.speaker.listening) {
        lines.slice(0, 2).forEach((ln, i) => drawText(fb, ln, W / 2, py + 73 + i * 12, C.orange, { align: 'center', outline: C.ink }));
      } else {
        statusLine(app, this.speaker, py + 80, shield ? 'Tap the shield and say it!' : 'Tap the mic and say it!');
      }
      micButton(app, Math.round(W / 2), py + 117, this.speaker, () => this.mic(), 14, shield);
    }
    // hear again / keyboard
    app.ui.button(fb, W - 34, py + 98, 26, 20, '', BTN.blue, () => { sfx.unlock(); sfx.play('tap'); say(word.w); }, { icon: ICON.speaker, name: 'hear' });
    app.ui.button(fb, 8, py + 98, 26, 20, '', BTN.gray, () => this.toggleTyping(), { icon: ICON.kbd, name: 'keyboard' });
  }

  private drawSpeak(py: number): void {
    const card = this.sel;
    if (!card) return;
    this.answerBlock(py, card.word, this.b.attacker.level, false);
  }

  private drawDefend(py: number): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    const def = this.b.defender;
    const w = this.defWord;
    if (!w) return;
    // clock
    drawText(fb, 'SHIELD!', 8, py + 5, C.ice, { outline: C.ink });
    if (this.defLimit > 0) {
      const frac = this.defLeft / this.defLimit;
      bar(fb, W - 66, py + 8, 58, 6, frac, frac > 0.4 ? C.sky : C.berry, C.navy);
    }
    this.answerBlock(py, w, def.level, true);
  }

  private drawVictory(py: number): void {
    const app = this.app;
    const fb = app.fb;
    const { W } = app;
    drawText(fb, 'VICTORY!', W / 2, py + 6, C.sun, { align: 'center', scale: 2, outline: C.ink, pixel: true });
    drawText(fb, 'New spell cards:', W / 2, py + 40, C.mist, { align: 'center' });
    const words = [...this.used.values()].slice(0, 6);
    const cols = Math.min(words.length, 3);
    words.forEach((w, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cw = 54;
      const x0 = Math.round((W - cols * cw) / 2) + col * cw;
      const y = py + 56 + row * 30;
      if (w.icon) {
        const sp = emojiSprite(w.icon, 20);
        fb.blit(sp, x0 + Math.round((cw - sp.w) / 2), y);
      }
      drawText(fb, w.w, x0 + cw / 2, y + 20, C.snow, { align: 'center' });
    });
    if (this.pt > 0.8) {
      app.ui.button(fb, 20, py + PANEL_H - 34, W - 40, 24, 'CONTINUE', BTN.primary, () => {
        sfx.play('select');
        this.leaveBattle();
      });
    }
  }
}
