import { Battle, monsterHp } from '../game/battle';
import { Shield } from '../game/shield';
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
import { sfx, say, stopSay } from '../audio/sfx';
import { Rng } from '../util/rng';
import type { Word } from '../data/words';
import { artUrl, shieldLayers, typeOf, type Mon } from '../mon/dex';
import { partnerMon } from './partner';
import { BattleView } from './battle-view';

export const MAX_TRIES = 3;
/** Seconds to raise a shield once the wild creature winds up. Even the youngest players get one, with plenty of time. */
const DEFENSE_TIME: Record<number, number> = { 1: 14, 2: 9, 3: 7, 4: 6 };

export type Phase = 'speak' | 'strike' | 'defend' | 'resolve' | 'victory';

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
  /** Called when the wild creature is beaten, with the words used. */
  onWin: (foe: Mon, words: Word[]) => { isNew: boolean; nextLabel: string } | void = () => {};
  onLeave: () => void = () => {};
  onNextFoe: () => void = () => {};

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
    view.onPartner = (i) => this.switchTo(i);
    view.onSubmitTyped = (t) => this.answer({ kind: 'typed', text: t });
    view.onNext = () => this.onNextFoe();
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
    const maxHp = monsterHp(this.players, 0, bossFoe);
    this.battle = new Battle({ name: this.foe.name, hp: maxHp, maxHp, boss: bossFoe }, this.players, firstPlayer);
    this.shield = bossFoe ? new Shield(Math.max(2, shieldLayers(this.foe) || 3)) : null;
    this.learned = [];
    this.recent = [];
    this.revenge = new Revenge();
    this.view.setFoe(this.foe, bossFoe);
    this.view.setFoeHp(maxHp, maxHp);
    if (this.shield) this.view.setShields(this.shield.layers, this.shield.max);
    this.refreshParty();
    this.newRound();
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
    if (this.phase === 'defend') this.showDefend(); else this.deal();
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
      showConfirm: this.tries >= 1,
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
    say(this.phase === 'defend' && this.defWord ? this.defWord.w : this.word.w, 0.7);
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
    if (r.kind === 'fail') {
      this.rerender(failText(r.reason));
      return;
    }
    const cand = r.kind === 'heard' ? r.candidates : [r.text];
    const j = judge(w.w, cand, this.me.level, knownHearings(this.save.aliases, w));
    logHeard({ w: w.w, c: cand, r: j.tier, lv: this.me.level });
    this.lastHeard = cand;
    this.typing = false;
    if (j.tier === 'miss') {
      this.tries += 1;
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

  /** A grown-up says "they said it right". The engine's transcript is remembered for next time. */
  private confirm(): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    const defending = this.phase === 'defend';
    const w = defending && this.defWord ? this.defWord : this.word;
    if (this.lastHeard.length) {
      this.save = { ...this.save, aliases: learnHearing(this.save.aliases, w, this.lastHeard) };
      this.onSave(this.save);
      logHeard({ w: w.w, c: this.lastHeard, r: 'confirmed', lv: this.me.level });
    }
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
    if (defending) return this.resolveDefense(true);
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
      this.view.cast('me', fx.style, fx.colors, power, () => {
        sfx.play('shield');
        this.view.blockSpark('foe', '#4a90e2');
        this.view.floatText('foe', '被護盾彈開了！', '#4a90e2');
        this.view.shakeMe();
        window.setTimeout(() => this.afterAttack(), 1100);
      });
      return;
    }

    const mult = (this.revengeActive ? REVENGE_MULT : 1) * (wasUp ? 0.5 : 1);
    const res = this.battle.attack(this.word, tier, mult);
    if (wasUp && this.battle.monster.hp <= 0) { this.battle.monster.hp = 1; res.killed = false; }
    this.mark(this.word, true, tier, res.damage);
    this.view.cast('me', fx.style, fx.colors, power, () => {
      sfx.play('hit', power === 2 ? 4 : 2);
      this.view.hurt('foe');
      this.view.floatText('foe', `-${res.damage}`, '#ff5a5a');
      if (res.combo >= 2) this.view.floatText('foe', `${res.combo} 連擊！`, '#ffb300', true, 30);
      if (outcome === 'break' && sh) {
        this.view.setShields(sh.layers, sh.max);
        this.view.floatText('foe', sh.up ? '護盾裂開了！' : '護盾破了！', '#2e9e5b', true, 54);
        sfx.play('heal');
      }
      this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      window.setTimeout(() => (res.killed ? this.win() : this.afterAttack()), outcome === 'break' ? 1100 : 750);
    });
  }

  private fail(defending: boolean): void {
    this.speaker.cancel();
    this.mark(defending && this.defWord ? this.defWord : this.word, false);
    if (defending) return this.resolveDefense(false);
    this.battle.fizzle();
    this.revenge.miss(this.me.id, this.word, this.battle.round);
    this.view.showWait(`咒語是「${this.word.w}」，下次再來！`);
    say(this.word.w, 0.7);
    window.setTimeout(() => this.afterAttack(), 1400);
  }

  /** After a spell, the wild creature strikes back (unless it is already down). */
  private afterAttack(): void {
    if (this.dead) return;
    const t = DEFENSE_TIME[this.me.level] ?? DEFENSE_TIME[1];
    if (this.battle.monster.hp > 0) this.startDefend(t);
    else {
      this.battle.nextRound();
      this.newRound();
    }
  }

  // ---- defend ---------------------------------------------------------------

  private startDefend(seconds: number): void {
    this.phase = 'defend';
    this.defWord = pickDefenseWord(this.me, Date.now(), this.rng, this.recent);
    this.tries = 0;
    this.lastHeard = [];
    this.defLeft = seconds;
    this.defTotal = seconds;
    this.view.setCharging(true);
    sfx.play('warn');
    this.view.floatText('foe', '要攻擊了！', '#d9534f', true);
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
      showConfirm: this.tries >= 1,
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

  private resolveDefense(ok: boolean): void {
    this.stopTimer();
    if (this.phase === 'resolve') return;
    this.phase = 'resolve';
    this.view.setCharging(false);
    const w = this.defWord;
    const res = this.battle.defend(ok);
    if (w && ok) this.mark(w, true, 'good', res.reflect, true);
    this.view.showWait(ok ? '防禦！' : '糟糕…');
    const fx = typeOf(this.foe).fx;
    const mine = typeOf(this.partnerMon(this.me));
    if (ok) {
      this.view.raiseShield(mine.color);
      sfx.play('shield');
    }
    window.setTimeout(() => {
      this.view.cast('foe', fx.style, fx.colors, 1, () => {
        if (ok) {
          sfx.play('block');
          this.view.blockSpark('me', mine.color);
          this.view.floatText('me', '擋住了！', '#2fbf71');
          this.view.floatText('foe', `-${res.reflect}`, '#ff5a5a', true, 20);
          this.view.hurt('foe');
          this.view.dropShield();
        } else {
          sfx.play('hurt');
          this.view.flash('#d9534f', 0.25);
          this.view.hurt('me');
          this.view.floatText('me', '好痛！', '#ff5a5a');
        }
        this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
        window.setTimeout(() => {
          if (res.killed) return this.win();
          this.battle.nextRound();
          this.newRound();
        }, 1000);
      });
    }, ok ? 280 : 0);
  }

  /** Leave the screen: stop timers and the microphone. */
  dispose(): void {
    this.dead = true;
    this.stopTimer();
    this.speaker.cancel();
    stopSay();
  }

  // ---- victory --------------------------------------------------------------

  private win(): void {
    if (this.dead) return;
    this.stopTimer();
    this.phase = 'victory';
    this.view.faintFoe();
    sfx.play('win');
    const seen = new Set<string>();
    const words = this.learned.filter((w) => !seen.has(w.id) && seen.add(w.id));
    const r = this.onWin(this.foe, words);
    window.setTimeout(() => this.view.showVictory(this.foe, words, r ? { isNew: r.isNew, nextLabel: r.nextLabel } : {}), 900);
  }
}
