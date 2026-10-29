import { Battle, monsterHp } from '../game/battle';
import { BossFight } from '../game/boss';
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
const DEFENSE_TIME: Record<number, number> = { 1: 0, 2: 8, 3: 7, 4: 6 };

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
  private timerId: number | null = null;
  private lastTick = 0;
  private speaker: Speaker;
  private rng: Rng;
  /** Co-op boss state; null for an ordinary wild creature. */
  boss: BossFight | null = null;
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
    this.boss = bossFoe ? new BossFight(Math.max(2, shieldLayers(this.foe) || 3)) : null;
    this.learned = [];
    this.recent = [];
    this.revenge = new Revenge();
    this.view.setFoe(this.foe, bossFoe);
    this.view.setFoeHp(maxHp, maxHp);
    if (this.boss) this.view.setShields(this.boss.layers, this.boss.maxLayers);
    this.refreshParty();
    this.newRound();
  }

  private refreshParty(): void {
    this.view.setParty(
      this.players.map((p, i) => {
        const m = this.partnerMon(p);
        const b = this.boss;
        return {
          img: artUrl(m.id),
          color: typeOf(m).color,
          level: p.level,
          on: i === this.battle.turn,
          locked: !!b && !b.canAct(i, this.players.length),
          down: !!b && b.launcher === i && b.stage !== 'launch' && b.stage !== 'done',
        };
      }),
    );
    this.view.setPartner(this.partnerMon(this.me));
  }

  private switchTo(i: number): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (this.boss && !this.boss.canAct(i, this.players.length)) {
      sfx.play('miss');
      this.view.floatText('me', this.boss.stage === 'finish' ? '還不行！' : '休息中…', '#5b6678', true);
      return;
    }
    if (i === this.battle.turn) return;
    this.speaker.cancel();
    this.typing = false;
    this.battle.select(i);
    this.refreshParty();
    if (this.phase === 'defend') this.showDefend(); else this.deal();
  }

  private newRound(): void {
    this.phase = 'speak';
    this.deal();
  }

  private deal(): void {
    const boss = this.boss;
    if (boss) {
      const who = boss.nextActor(this.battle.turn, this.players.length);
      if (who !== this.battle.turn) this.battle.select(who);
      this.refreshParty();
    }
    const p = this.me;
    const due = this.revenge.take(p.id, this.battle.round);
    this.revengeActive = !!due;
    // the super spell and the finisher are a stretch: one band harder than the player's own
    const stretch = boss && (boss.stage === 'launch' || boss.stage === 'finish') ? Math.min(4, p.level + 1) : p.level;
    this.word = due ?? dealCard(p, Date.now(), this.rng, this.recent, stretch).word;
    this.recent = [...this.recent.slice(-6), this.word.id];
    this.tries = 0;
    this.lastHeard = [];
    this.typing = false;
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

  private bossHint(): string | undefined {
    const b = this.boss;
    if (!b) return undefined;
    if (b.stage === 'launch') return '大人先上！念出超級咒語';
    if (b.stage === 'rescue') return `${b.move.zh}！大家一起打破護盾`;
    if (b.stage === 'finish') return '護盾破了！最後一擊！';
    return undefined;
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
    if (this.boss) return this.bossStrike(tier);
    const mult = this.revengeActive ? REVENGE_MULT : 1;
    const res = this.battle.attack(this.word, tier, mult);
    this.mark(this.word, true, tier, res.damage);
    this.learned.push(this.word);
    const fx = typeOf(this.partnerMon(this.me)).fx;
    this.view.showWait(tier === 'perfect' ? '太棒了！' : '很好！');
    sfx.play('hit');
    this.view.shoot(fx.colors, fx.style, () => {
      this.view.hurt('foe');
      this.view.floatText('foe', `-${res.damage}`, '#ff5a5a');
      if (res.combo >= 2) this.view.floatText('foe', `${res.combo} 連擊！`, '#ffb300', true, 30);
      this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      window.setTimeout(() => (res.killed ? this.win() : this.afterAttack()), 700);
    });
  }

  // ---- co-op boss -------------------------------------------------------------

  private bossStrike(tier: Tier): void {
    const boss = this.boss!;
    const stage = boss.stage;
    const who = this.battle.turn;
    this.mark(this.word, true, tier);
    this.learned.push(this.word);
    const fx = typeOf(this.partnerMon(this.me)).fx;
    const move = boss.move;
    this.view.showWait(stage === 'launch' ? '超級咒語！' : stage === 'rescue' ? `${move.zh}！` : '最後一擊！');
    sfx.play(tier === 'perfect' ? 'perfect' : 'good');
    this.view.shoot(fx.colors, fx.style, () => {
      const after = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
      if (stage === 'launch') {
        sfx.play('shield');
        this.view.hurt('foe');
        this.view.floatText('foe', '被護盾彈開了！', '#4a90e2');
        boss.launch(who);
        this.refreshParty();
        after(1900, () => { this.view.floatText('foe', '快幫忙打破護盾！', '#4a90e2', true); this.bossNext(); });
      } else if (stage === 'rescue') {
        const last = boss.breakLayer();
        this.battle.combo += 1;
        const dmg = this.battle.chip(0.1);
        this.mark(this.word, true, tier, dmg);
        sfx.play('hit');
        this.view.hurt('foe');
        this.view.floatText('foe', `${move.zh}！`, '#ffb300');
        this.view.floatText('foe', last ? '護盾破了！' : '護盾裂開了', '#2e9e5b', true, 30);
        this.view.setShields(boss.layers, boss.maxLayers);
        this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
        this.refreshParty();
        sfx.play('heal');
        after(last ? 1500 : 1000, () => this.bossNext());
      } else {
        const dmg = this.battle.finisher();
        this.mark(this.word, true, tier, dmg);
        boss.finish();
        this.view.hurt('foe');
        this.view.floatText('foe', `-${dmg}`, '#ff5a5a');
        this.view.setFoeHp(0, this.battle.monster.maxHp);
        after(900, () => this.win());
      }
    });
  }

  private bossNext(): void {
    this.battle.nextRound();
    this.newRound();
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

  private afterAttack(): void {
    if (this.boss) return this.bossNext(); // nobody is punished in a co-op boss fight
    const t = DEFENSE_TIME[this.me.level] ?? 0;
    if (t > 0 && this.battle.monster.hp > 0) this.startDefend(t);
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
      hint: `${this.foe.name} 要攻擊了！快念防禦咒語！`,
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
    const w = this.defWord;
    const res = this.battle.defend(ok);
    if (w && ok) this.mark(w, true, 'good', res.reflect, true);
    this.view.showWait(ok ? '防禦成功！反擊！' : '被打中了…');
    const fx = typeOf(this.foe).fx;
    this.view.foeAttack(fx.colors, () => {
      if (ok) {
        this.view.floatText('me', '擋住了！', '#2fbf71');
        this.view.floatText('foe', `-${res.reflect}`, '#ff5a5a', true, 20);
        this.view.hurt('foe');
        this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      } else {
        this.view.shakeMe();
        this.view.floatText('me', '好痛！', '#ff5a5a');
        this.view.setFoeHp(this.battle.monster.hp, this.battle.monster.maxHp);
      }
      window.setTimeout(() => {
        if (res.killed) return this.win();
        this.battle.nextRound();
        this.newRound();
      }, 900);
    });
  }

  /** Leave the screen: stop timers and the microphone. */
  dispose(): void {
    this.stopTimer();
    this.speaker.cancel();
    stopSay();
  }

  // ---- victory --------------------------------------------------------------

  private win(): void {
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
