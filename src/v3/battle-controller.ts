import { Battle } from '../game/battle';
import { Shield } from '../game/shield';
import { ENTRANCE, gradeOf, heartsFor, shieldLayersFor, type Grade } from '../mon/rarity';
import { DEFENSE, rollDefense, type DefenseKind } from '../game/defense';
import { Afflictions, STATUS, STATUS_ORDER, rollStatus } from '../game/status';
import { foeHp, typicalHit, TIRED_ROUND } from './pacing';
import { dealCard, pickDefenseWord } from '../game/deck';
import { Revenge, REVENGE_MULT } from '../game/revenge';
import { record } from '../game/progress';
import type { Player } from '../game/model';
import type { Save } from '../game/save';
import { judge, type Tier } from '../speech/match';
import { knownHearings, learnHearing } from '../speech/learn';
import { logHeard } from '../speech/heardlog';
import { Speaker, type SpeakResult } from '../speech/speaker';
import type { Recognizer } from '../speech/recognizer';
import { sfx, sayWord, stopSay } from '../audio/sfx';
import { Rng } from '../util/rng';
import type { Word } from '../data/words';
import { artUrl, typeOf, type Mon } from '../mon/dex';
import { partnerMon } from './partner';
import { BattleView } from './battle-view';

export const MAX_TRIES = 3;
/** Defending: this many attempts the engine could not make out and the shield goes up anyway. */
export const RESCUE_AFTER = 2;
/** Attacking: this many unrecognised attempts and the "I said it" / "skip" buttons appear. */
export const STUCK_AFTER = 3;
/** Seconds to raise a shield once the wild creature winds up. Even the youngest players get one, with plenty of time. */
const DEFENSE_TIME: Record<number, number> = { 1: 14, 2: 9, 3: 7, 4: 6 };

export type Phase = 'speak' | 'strike' | 'defend' | 'resolve' | 'victory' | 'lost';

function failText(reason: string): string {
  switch (reason) {
    case 'denied': return '麥克風被擋住了，請允許使用，或改用鍵盤';
    case 'unsupported': return '這裡不能用語音，請按鍵盤輸入';
    case 'no-speech': return '沒聽到，再按一次麥克風';
    default: return '哎呀，再試一次！';
  }
}

/** The new Pokémon-style battle: partner (you) vs a wild creature, spells are English words. */
export class BattleController {
  phase: Phase = 'speak';
  battle!: Battle;
  foe!: Mon;
  word!: Word;
  tries = 0;
  /** attempts that did not count as a hearing (wrong words and "heard nothing" alike) */
  attempts = 0;
  lastHeard: string[] = [];
  defLeft = 0;
  defWord: Word | null = null;
  private recent: string[] = [];
  private revenge = new Revenge();
  private revengeActive = false;
  private learned: Word[] = [];
  private typing = false;
  private dead = false;
  private timerId: number | null = null;
  private lastTick = 0;
  private speaker: Speaker;
  private rng: Rng;
  /** The boss's shield; null for an ordinary wild creature. */
  shield: Shield | null = null;
  /** Conditions on the wild creature (burn, sleep, …). */
  aff = new Afflictions();
  /** Tests switch this off so a lucky status can't change the flow. */
  statusEnabled = true;
  /** Called when the wild creature is beaten, with the words used. */
  onWin: (foe: Mon, words: Word[]) => { isNew: boolean; nextLabel: string } | void = () => {};
  onLeave: () => void = () => {};
  onNextFoe: () => void = () => {};
  /** The party ran out of hearts and picked "back to the map". */
  onLose: () => void = () => {};
  hearts = 0;
  maxHearts = 0;

  constructor(
    private view: BattleView,
    private save: Save,
    rec: Recognizer,
    private onSave: (s: Save) => void,
    seed = Date.now(),
  ) {
    this.rng = new Rng(seed);
    this.speaker = new Speaker(rec);
    view.onMic = () => this.mic();
    view.onHear = () => this.hear();
    view.onKeyboard = () => this.openKeyboard();
    view.onConfirm = () => this.confirm();
    view.onSkip = () => this.skip();
    view.onPartner = (i) => this.switchTo(i);
    view.onSubmitTyped = (t) => this.answer({ kind: 'typed', text: t });
    view.onNext = () => this.onNextFoe();
    view.onLose = () => this.onLose();
    view.onLeave = () => { this.stopTimer(); this.speaker.cancel(); stopSay(); this.onLeave(); };
  }

  get players(): Player[] { return this.save.players; }
  get me(): Player { return this.battle.attacker; }
  partnerMon(p: Player): Mon {
    return partnerMon(p, this.players.indexOf(p));
  }

  start(foe?: Mon, bossFoe = false, firstPlayer = 0): void {
    this.stopTimer();
    this.speaker.cancel();
    this.foe = foe ?? this.foe;
    const maxHp = foeHp(this.players, this.foe.rarity, bossFoe);
    this.battle = new Battle({ name: this.foe.name, hp: maxHp, maxHp, boss: bossFoe }, this.players, firstPlayer);
    const layers = shieldLayersFor(this.foe.rarity, bossFoe);
    this.shield = layers > 0 ? new Shield(layers) : null;
    this.maxHearts = heartsFor(this.foe.rarity, bossFoe);
    this.hearts = this.maxHearts;
    this.view.setHearts(this.hearts, this.maxHearts);
    this.aff = new Afflictions();
    this.view.setStatus(null);
    this.learned = [];
    this.recent = [];
    this.revenge = new Revenge();
    this.view.setFoe(this.foe, bossFoe);
    this.view.setFoeHp(maxHp, maxHp);
    if (this.shield) this.view.setShields(this.shield.layers, this.shield.max);
    if (this.grade !== 'common') {
      this.view.entrance(this.grade, ENTRANCE[this.grade]);
      sfx.play('rare', this.grade === 'legend' ? 1 : 0);
    }
    this.refreshParty();
    this.newRound();
  }

  /** How special the foe is: rare and legendary ones look, sound and hit differently. */
  get grade(): Grade {
    return gradeOf(this.foe.rarity);
  }

  private refreshParty(): void {
    this.view.setParty(
      this.players.map((p, i) => {
        const m = this.partnerMon(p);
        return { img: artUrl(m.id), color: typeOf(m).color, level: p.level, on: i === this.battle.turn, adult: !!p.adult };
      }),
    );
    this.view.setPartner(this.partnerMon(this.me));
  }

  private switchTo(i: number): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (i === this.battle.turn) return;
    this.speaker.cancel();
    this.typing = false;
    this.battle.select(i);
    this.refreshParty();
    if (this.phase === 'defend') {
      // the new defender gets a shield word at their own level, with a fresh set of tries
      this.defWord = pickDefenseWord(this.me, Date.now(), this.rng, this.recent);
      this.tries = 0;
      this.attempts = 0;
      this.lastHeard = [];
      this.showDefend();
    } else this.deal();
  }

  private newRound(): void {
    if (this.dead) return;
    this.phase = 'speak';
    this.deal();
  }

  private deal(): void {
    const p = this.me;
    const due = this.revenge.take(p.id, this.battle.round);
    this.revengeActive = !!due;
    this.word = due ?? dealCard(p, Date.now(), this.rng, this.recent).word;
    this.recent = [...this.recent.slice(-6), this.word.id];
    this.tries = 0;
    this.attempts = 0;
    this.lastHeard = [];
    this.typing = false;
    this.refreshParty();
    this.render('說出這個英文單字，放出招式！');
  }

  private render(note = ''): void {
    this.view.showWord({
      mode: 'speak',
      word: this.word,
      hint: this.bossHint() ?? (this.revengeActive ? '再挑戰一次，傷害變大！' : '念出咒語攻擊！'),
      revenge: this.revengeActive,
      showConfirm: this.tries >= 1 || this.attempts >= 1,
      stuck: this.attempts >= STUCK_AFTER,
      listening: this.speaker.listening,
      typing: this.typing,
      note,
    });
  }

  /** While the shield is up, grown-ups are told they will bounce and children are told to break it. */
  private bossHint(): string | undefined {
    const sh = this.shield;
    if (!sh?.up) return sh ? '護盾破了！大家一起攻擊！' : undefined;
    if (this.me.adult && this.hasKid()) return '護盾還在！大人的咒語會被彈開，換小朋友來打破它';
    return `打破護盾！還剩 ${sh.layers} 層`;
  }

  private hasKid(): boolean {
    return this.players.some((p) => !p.adult);
  }

  // ---- speaking -------------------------------------------------------------

  private hear(): void {
    sfx.unlock();
    { const w = this.phase === 'defend' && this.defWord ? this.defWord : this.word; sayWord(w.w, w.zh); }
  }

  private mic(): void {
    sfx.unlock();
    stopSay();
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (this.speaker.listening) {
      this.speaker.cancel();
      this.rerender();
      return;
    }
    const w = this.phase === 'defend' && this.defWord ? this.defWord : this.word;
    this.speaker.listen((r) => this.answer(r), [w.w, ...knownHearings(this.save.aliases, w)]);
    this.rerender('聽著…');
    this.pollInterim();
  }

  private pollInterim(): void {
    if (!this.speaker.listening) return;
    if (this.speaker.interim) this.view.setNote(`“${this.speaker.interim}”`);
    window.setTimeout(() => this.pollInterim(), 150);
  }

  private openKeyboard(): void {
    this.speaker.cancel();
    this.typing = true;
    this.rerender();
  }

  private rerender(note = ''): void {
    if (this.phase === 'defend') this.showDefend(note);
    else if (this.phase === 'speak') this.render(note);
  }

  private answer(r: SpeakResult): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    const defending = this.phase === 'defend';
    const w = defending && this.defWord ? this.defWord : this.word;
    const lv = this.me.level;
    if (r.kind === 'fail') {
      if (r.reason === 'aborted') return;
      // nothing came back: that still counts as an attempt, or the round could never end
      logHeard({ w: w.w, c: [r.reason], r: 'none', lv, defend: defending });
      this.attempts += 1;
      if (defending && this.attempts >= RESCUE_AFTER) return this.rescue(w);
      this.rerender(failText(r.reason));
      return;
    }
    const cand = r.kind === 'heard' ? r.candidates : [r.text];
    const j = judge(w.w, cand, lv, knownHearings(this.save.aliases, w));
    logHeard({ w: w.w, c: cand, r: j.tier, lv, defend: defending });
    this.lastHeard = cand;
    this.typing = false;
    if (j.tier === 'miss') {
      this.tries += 1;
      this.attempts += 1;
      if (defending && this.attempts >= RESCUE_AFTER) return this.rescue(w);
      if (this.tries >= MAX_TRIES) {
        this.fail(defending);
      } else {
        sfx.play('miss');
        this.rerender(`聽到「${j.heard || '…'}」，再試一次！`);
      }
      return;
    }
    this.succeed(j.tier, defending);
  }

  /**
   * Defending and the engine keeps not understanding: assume it was said, and give a plain
   * block (no reflect or counter bonus). It is logged so the word can be fixed afterwards.
   */
  private rescue(w: Word): void {
    this.speaker.cancel();
    logHeard({ w: w.w, c: this.lastHeard, r: 'rescued', lv: this.me.level, defend: true });
    this.resolveDefense(true, 'good', 'block');
  }

  /** Stuck on an attack word: let it go (a fizzle, like three wrong tries) and move on. */
  private skip(): void {
    if (this.phase !== 'speak') return;
    logHeard({ w: this.word.w, c: this.lastHeard, r: 'skipped', lv: this.me.level });
    this.fail(false);
  }

  /** A grown-up says "they said it right". The engine's transcript is remembered for next time. */
  private confirm(): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    const defending = this.phase === 'defend';
    const w = defending && this.defWord ? this.defWord : this.word;
    if (this.lastHeard.length) {
      this.save = { ...this.save, aliases: learnHearing(this.save.aliases, w, this.lastHeard) };
      this.onSave(this.save);
    }
    logHeard({ w: w.w, c: this.lastHeard, r: 'confirmed', lv: this.me.level, defend: defending });
    this.succeed('good', defending);
  }

  private mark(word: Word, ok: boolean, tier?: Tier, dealt = 0, blocked = false): void {
    const p = this.me;
    const i = this.players.indexOf(p);
    const st = p.stats;
    const np: Player = {
      ...p,
      progress: record(p.progress, word.id, ok, Date.now()),
      stats: ok
        ? { ...st, words: st.words + 1, perfect: st.perfect + (tier === 'perfect' ? 1 : 0), dealt: st.dealt + dealt, blocks: st.blocks + (blocked ? 1 : 0) }
        : st,
    };
    this.save = { ...this.save, players: this.players.map((q, k) => (k === i ? np : q)) };
    this.battle.players = this.save.players;
    this.onSave(this.save);
  }

  // ---- attack ---------------------------------------------------------------

  private succeed(tier: Tier, defending: boolean): void {
    this.speaker.cancel();
    if (defending) return this.resolveDefense(true, tier === 'perfect' ? 'perfect' : 'good');
    this.phase = 'strike';
    const sh = this.shield;
    const wasUp = !!sh?.up;
    const outcome = sh ? sh.resolve(!!this.me.adult, this.hasKid()) : 'hit';
    const partner = this.partnerMon(this.me);
    const fx = typeOf(partner).fx;
    const power = tier === 'perfect' ? 2 : 1;
    this.learned.push(this.word);
    this.view.showWait(outcome === 'bounce' ? '護盾擋住了！' : tier === 'perfect' ? '完美！' : '很好！');
    sfx.play(tier === 'perfect' ? 'perfect' : 'good');

    if (outcome === 'bounce') {
      this.mark(this.word, true, tier);
      this.battle.combo = 0;
      sfx.cast(fx.style);
      this.view.cast('me', fx.style, fx.colors, power, () => {
        sfx.play('shield');
        this.view.blockSpark('foe', '#4a90e2');
        this.view.floatText('foe', '被護盾彈開了！', '#4a90e2');
        this.view.shakeMe();
        window.setTimeout(() => this.afterAttack(), 1100);
      });
      return;
    }

    const mult = this.revengeActive ? REVENGE_MULT : 1;
    const res = this.battle.attack(this.word, tier, mult);
    if (wasUp && this.battle.monster.hp <= 0) { this.battle.monster.hp = 1; res.killed = false; }
    this.mark(this.word, true, tier, res.damage);
    sfx.cast(fx.style);
    this.view.cast('me', fx.style, fx.colors, power, () => {
      sfx.play('hit', power === 2 ? 4 : 2);
      this.view.hurt('foe');
      this.view.floatText('foe', `-${res.damage}`, '#ff5a5a');
      if (res.combo >= 2) this.view.floatText('foe', `${res.combo} 連擊！`, '#ffb300', true, 30);
      if (outcome === 'break' && sh) {
        this.view.setShields(sh.layers, sh.max);
        this.view.floatText('foe', sh.up ? '護盾裂開了！' : '護盾破了！', '#2e9e5b', true, 54);
        sfx.play('shieldBreak', sh.up ? 0 : 1);
      }
      this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      if (!res.killed) this.tryStatus(tier === 'perfect' ? 'perfect' : 'good');
      window.setTimeout(() => (res.killed ? this.win() : this.afterAttack()), outcome === 'break' ? 1100 : this.aff.current ? 1000 : 750);
    });
  }

  private fail(defending: boolean): void {
    this.speaker.cancel();
    this.mark(defending && this.defWord ? this.defWord : this.word, false);
    if (defending) return this.resolveDefense(false);
    this.battle.fizzle();
    this.revenge.miss(this.me.id, this.word, this.battle.round);
    this.view.showWait(`咒語是「${this.word.w}」，下次再來！`);
    sayWord(this.word.w, this.word.zh);
    window.setTimeout(() => this.afterAttack(), 1400);
  }

  /** A spell that landed may leave the creature burning, asleep, and so on. */
  private tryStatus(tier: 'good' | 'perfect'): void {
    if (!this.statusEnabled || this.aff.current) return;
    const id = rollStatus(this.partnerMon(this.me).type, tier, this.rng, this.shield ? 0.5 : 1);
    if (id && this.aff.apply(id)) {
      const st = STATUS[id];
      this.view.floatText('foe', `${st.zh}！`, st.color, true, 56);
      sfx.play('status', STATUS_ORDER.indexOf(id));
      this.refreshStatus();
    }
  }

  private refreshStatus(): void {
    const c = this.aff.current;
    this.view.setStatus(c ? { ...STATUS[c.id], left: c.left } : null);
  }

  /** After a spell, the wild creature strikes back — unless it is down, or a condition stops it. */
  private afterAttack(): void {
    if (this.dead) return;
    if (this.battle.monster.hp <= 0) return this.finishRound();
    const act = this.aff.beforeCounter(this.rng);
    if (act === 'act') return this.startDefend(DEFENSE_TIME[this.me.level] ?? DEFENSE_TIME[1]);
    const st = this.aff.info!;
    if (act === 'selfhit') {
      const dmg = Math.max(2, Math.round(typicalHit(this.players) * 0.4));
      this.battle.monster.hp = Math.max(1, this.battle.monster.hp - dmg);
      this.view.floatText('foe', `${st.zh}，打到自己！ -${dmg}`, st.color, true);
      this.view.hurt('foe');
      this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
    } else {
      this.view.floatText('foe', `${st.zh}，動不了！`, st.color, true);
    }
    this.view.showWait(`${this.foe.name} ${st.zh}了，不能攻擊！`);
    window.setTimeout(() => this.finishRound(), 1100);
  }

  /** End of a round: damage over time, then a fresh word. A fight that drags on ends gently. */
  private finishRound(): void {
    if (this.dead) return;
    const m = this.battle.monster;
    const { dot, cured } = this.aff.endRound(m.maxHp);
    let delay = 0;
    if (dot > 0 && m.hp > 0) {
      const st = this.aff.info ?? cured;
      m.hp = Math.max(0, m.hp - dot);
      this.view.floatText('foe', `${st?.zh ?? ''} -${dot}`, st?.color ?? '#d9534f', true);
      this.view.hurt('foe');
      this.view.setFoeHp(m.hp, m.maxHp);
      delay = 900;
    }
    if (cured) this.view.floatText('foe', `${cured.zh}好了`, '#2e9e5b', true, 30);
    this.refreshStatus();
    window.setTimeout(() => {
      if (this.dead) return;
      if (m.hp <= 0) return this.win();
      this.battle.nextRound();
      // after a few rounds the creature is worn out: one more hit will do
      if (!this.shield && this.battle.round >= TIRED_ROUND) {
        const one = typicalHit(this.players);
        if (m.hp > one) {
          m.hp = one;
          this.view.setFoeHp(m.hp, m.maxHp);
          this.view.floatText('foe', '累了…', '#5b6678', true);
        }
      }
      this.newRound();
    }, delay);
  }

  // ---- defend ---------------------------------------------------------------

  private startDefend(seconds: number): void {
    this.phase = 'defend';
    this.defWord = pickDefenseWord(this.me, Date.now(), this.rng, this.recent);
    this.tries = 0;
    this.attempts = 0;
    this.lastHeard = [];
    this.defLeft = seconds;
    this.defTotal = seconds;
    this.view.setCharging(true);
    const g = this.grade;
    sfx.play('warn', g === 'legend' ? 2 : g === 'rare' ? 1 : 0);
    this.view.floatText('foe', g === 'legend' ? '強大的攻擊要來了！' : '要攻擊了！', '#d9534f', true);
    if (g !== 'common') this.view.flash('#d9534f', g === 'legend' ? 0.3 : 0.18);
    this.showDefend();
    this.lastTick = performance.now();
    this.stopTimer();
    this.timerId = window.setInterval(() => this.tick(), 100);
  }
  private defTotal = 1;

  private showDefend(note = ''): void {
    if (!this.defWord) return;
    this.view.showWord({
      mode: 'defend',
      word: this.defWord,
      hint: `${this.foe.name} 要攻擊了！念出防禦咒語擋住牠！`,
      showConfirm: this.tries >= 1 || this.attempts >= 1,
      listening: this.speaker.listening,
      typing: this.typing,
      note,
      timer: true,
    });
    this.view.setTimer(this.defLeft / this.defTotal);
  }

  private tick(): void {
    const now = performance.now();
    this.defLeft -= (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.view.setTimer(this.defLeft / this.defTotal);
    if (this.defLeft <= 0) {
      this.stopTimer();
      this.speaker.cancel();
      this.resolveDefense(false);
    }
  }

  private stopTimer(): void {
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private resolveDefense(ok: boolean, tier: 'good' | 'perfect' = 'good', force?: DefenseKind): void {
    this.stopTimer();
    if (this.phase === 'resolve') return;
    this.phase = 'resolve';
    this.view.setCharging(false);
    const w = this.defWord;
    const kind: DefenseKind | null = ok ? force ?? rollDefense(tier, this.rng) : null;
    const res = this.battle.defend(ok, kind ? DEFENSE[kind].mult : 1);
    if (w && ok) this.mark(w, true, tier, res.reflect, true);
    this.view.showWait(kind ? DEFENSE[kind].zh : '糟糕…');
    const foeFx = typeOf(this.foe).fx;
    const mine = typeOf(this.partnerMon(this.me));
    const done = (): void => {
      this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      window.setTimeout(() => {
        if (res.killed) return this.win();
        this.finishRound();
      }, 1000);
    };
    const label = (): void => {
      if (!kind) return;
      const d = DEFENSE[kind];
      this.view.floatText('me', d.zh, d.color);
      if (res.reflect > 0) this.view.floatText('foe', `-${res.reflect}${d.mult > 1 ? ' ×1.5' : ''}`, '#ff5a5a', true, 20);
    };

    if (!kind) {
      this.foeCast(foeFx, { dx: 0, dy: 0 }, () => {
        sfx.play('hurt');
        this.view.flash('#d9534f', 0.25);
        if (this.grade !== 'common') this.view.shake(this.grade === 'legend' ? 16 : 10, 420);
        this.view.hurt('me');
        this.view.floatText('me', '好痛！', '#ff5a5a');
        this.hearts = Math.max(0, this.hearts - 1);
        this.view.setHearts(this.hearts, this.maxHearts);
        if (this.hearts === 0) {
          window.setTimeout(() => this.lose(), 700);
          return;
        }
        done();
      });
      return;
    }
    sfx.play(kind === 'dodge' ? 'dodge' : 'shield');
    if (kind === 'counter') {
      // no waiting for the hit: the partner answers with its own move
      sfx.cast(mine.fx.style);
      this.view.cast('me', mine.fx.style, mine.fx.colors, 2, () => {
        sfx.play('hit', 4);
        label();
        this.view.hurt('foe');
        done();
      });
      return;
    }
    if (kind === 'dodge') this.view.dodge(); else this.view.raiseShield(mine.color);
    window.setTimeout(() => {
      this.foeCast(foeFx, kind === 'dodge' ? { dx: -120, dy: -50 } : { dx: 0, dy: 0 }, () => {
        if (kind === 'dodge') {
          label();
          done();
          return;
        }
        sfx.play('block');
        this.view.blockSpark('me', mine.color);
        this.view.dropShield();
        label();
        if (kind === 'reflect') {
          // the creature's own move comes back at it
          sfx.play('reflect');
          this.view.cast('me', foeFx.style, foeFx.colors, 1, () => {
            sfx.play('hit', 2);
            this.view.hurt('foe');
            done();
          });
        } else done();
      });
    }, 280);
  }

  /**
   * The creature's own move. A rare one throws it bigger; a legendary one throws it twice (the
   * second only for show) and rattles the screen when it lands.
   */
  private foeCast(fx: { style: string; colors: string[] }, aim: { dx: number; dy: number }, hit: () => void): void {
    const g = this.grade;
    sfx.cast(fx.style);
    if (g === 'legend') window.setTimeout(() => this.view.cast('foe', fx.style, fx.colors, 2, () => {}, aim), 170);
    this.view.cast('foe', fx.style, fx.colors, g === 'common' ? 1 : 2, () => {
      if (g !== 'common') this.view.shake(g === 'legend' ? 12 : 7, 380);
      hit();
    }, aim);
  }

  /** Leave the screen: stop timers and the microphone. */
  dispose(): void {
    this.dead = true;
    this.stopTimer();
    this.speaker.cancel();
    stopSay();
  }

  // ---- defeat ---------------------------------------------------------------

  private lose(): void {
    if (this.dead) return;
    this.stopTimer();
    this.speaker.cancel();
    this.phase = 'lost';
    this.view.setCharging(false);
    sfx.setMusic(null);
    sfx.play('lose');
    this.view.showDefeat(this.foe);
  }

  // ---- victory --------------------------------------------------------------

  private win(): void {
    if (this.dead) return;
    this.stopTimer();
    this.phase = 'victory';
    this.view.faintFoe();
    sfx.setMusic(null);
    sfx.play('win');
    const seen = new Set<string>();
    const words = this.learned.filter((w) => !seen.has(w.id) && seen.add(w.id));
    const r = this.onWin(this.foe, words);
    window.setTimeout(() => this.view.showVictory(this.foe, words, r ? { isNew: r.isNew, nextLabel: r.nextLabel } : {}), 900);
  }
}
