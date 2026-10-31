import { Battle } from '../game/battle';
import { Shield } from '../game/shield';
import { haptics } from '../audio/haptics';
import { vibrationFor } from './capture';
import { ENTRANCE, gradeOf, heartsFor, shieldLayersFor, type Grade } from '../mon/rarity';
import { DEFENSE, rollDefense, type DefenseKind } from '../game/defense';
import { Afflictions, STATUS, STATUS_ORDER, rollStatus } from '../game/status';
import { foeHp, typicalHit, TIRED_ROUND } from './pacing';
import { dealCard, dealHardCard, pickDefenseWord, recordHard, rollHard } from '../game/deck';
import { addXp, evolvesTo, growthOf, isReady, stageOf, takeStep, xpFor, xpNeeded, type GrowStep } from '../mon/growth';
import { chooseRound, listenChoices, memoryDeck, roundPrefs, spellPuzzle, type ListenRound, type MemoryCard, type RoundType, type SpellRound } from './rounds';
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
import { artUrl, MON_BY_ID, typeOf, type Mon } from '../mon/dex';
import { partnerMon } from './partner';
import { BattleView } from './battle-view';

export const MAX_TRIES = 3;
/** Defending: this many attempts the engine could not make out and the shield goes up anyway. */
export const RESCUE_AFTER = 2;
/** Attacking: this many unrecognised attempts and the "I said it" / "skip" buttons appear. */
export const STUCK_AFTER = 3;
/** Seconds to raise a shield once the wild creature winds up. Even the youngest players get one, with plenty of time. */
const DEFENSE_TIME: Record<number, number> = { 1: 14, 2: 9, 3: 7, 4: 6 };
/** A hard word said right lands as a critical hit. */
export const CRIT_MULT = 1.5;
/** Memory match: this many wrong pairs or fewer still counts as perfect. */
const MEMORY_PERFECT = 2;

/** A partner that took a step (evolved or gained a star) after a win. */
export interface Grown {
  seat: number;
  step: GrowStep;
}

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
  /** what kind of attack round this is (say it, hear-and-pick, spell, memory) */
  round: RoundType = 'speak';
  /** this card is a hard one: right = a critical hit */
  hard = false;
  /** were the last attack cards hard (never more than one in three) */
  private hardHist: boolean[] = [];
  private memoryUsed = false;
  listenR: (ListenRound & { wrong: string[] }) | null = null;
  spellR: (SpellRound & { got: number[]; used: boolean[]; bad: boolean[]; mistakes: number }) | null = null;
  /** the dealt attack card has been answered (a re-deal before that replaces it in the hard history) */
  private cardPlayed = true;
  memR: { cards: MemoryCard[]; open: number[]; matched: string[]; misses: number; lock: boolean } | null = null;
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
    view.onPick = (i) => this.pick(i);
    view.onTile = (i) => this.tile(i);
    view.onFlip = (i) => this.flip(i);
    view.onPartner = (i) => this.switchTo(i);
    view.onSubmitTyped = (t) => this.answer({ kind: 'typed', text: t });
    view.onNext = () => this.onNextFoe();
    view.onLose = () => this.onLose();
    view.onLeave = () => this.askLeave();
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
    const layers = shieldLayersFor(this.foe.rarity, bossFoe);
    // a shielded creature bounces grown-ups' spells: start on a child, who can actually break it
    const kid = this.players.findIndex((p) => !p.adult);
    if (layers > 0 && this.players[firstPlayer]?.adult && kid >= 0) firstPlayer = kid;
    this.battle = new Battle({ name: this.foe.name, hp: maxHp, maxHp, boss: bossFoe }, this.players, firstPlayer);
    this.shield = layers > 0 ? new Shield(layers) : null;
    this.maxHearts = heartsFor(this.foe.rarity, bossFoe);
    this.hearts = this.maxHearts;
    this.view.setHearts(this.hearts, this.maxHearts);
    this.aff = new Afflictions();
    this.view.setStatus(null);
    this.learned = [];
    this.recent = [];
    this.hardHist = [];
    this.memoryUsed = false;
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
        return { img: artUrl(m.id), color: typeOf(m).color, level: p.level, on: i === this.battle.turn, adult: !!p.adult, name: p.name, mon: m.name };
      }),
    );
    this.view.setPartner(this.partnerMon(this.me));
    this.showXp();
  }

  /** The active partner's experience bar and rank. */
  private showXp(id = this.partnerMon(this.me).id): void {
    const g = growthOf(this.save.growth, id);
    const need = xpNeeded(g);
    this.view.setXp({ frac: need === null ? 1 : g.xp / need, rank: g.rank, stars: g.stars, ready: isReady(g), max: need === null });
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
      // the new defender gets their own amount of time (a little one taking over from a grown-up gets more)
      this.defTotal = DEFENSE_TIME[this.me.level] ?? DEFENSE_TIME[1];
      this.defLeft = Math.max(this.defLeft, this.defTotal);
      this.lastTick = performance.now();
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
    let hard = false;
    // switching player before answering re-deals: that card never counted
    const hist = this.cardPlayed ? this.hardHist : this.hardHist.slice(0, -1);
    if (due) this.word = due;
    else {
      const rank = growthOf(this.save.growth, this.partnerMon(p).id).rank;
      const card = rollHard(rank, hist, this.rng)
        ? dealHardCard(p, Date.now(), this.rng, this.recent)
        : dealCard(p, Date.now(), this.rng, this.recent);
      this.word = card.word;
      hard = !!card.hard;
    }
    this.hard = hard;
    // a revenge card that repeats a hard word still counts as hard for the one-in-three rule
    this.hardHist = recordHard(this.hardHist, hard || (!!due && due.lv > p.level), !this.cardPlayed);
    this.cardPlayed = false;
    this.recent = [...this.recent.slice(-6), this.word.id];
    this.tries = 0;
    this.attempts = 0;
    this.lastHeard = [];
    this.typing = false;
    this.setupRound();
    this.refreshParty();
    this.render();
    if (this.round === 'listen') window.setTimeout(() => { if (!this.dead && this.round === 'listen' && this.phase === 'speak') sayWord(this.word.w, ''); }, 350);
  }

  /** Decide the kind of round and build its puzzle; anything that cannot be built is spoken. */
  private setupRound(): void {
    const p = this.me;
    this.listenR = null;
    this.spellR = null;
    this.memR = null;
    let kind = chooseRound({
      rng: this.rng,
      prefs: roundPrefs(this.save.rounds),
      level: p.level,
      word: this.word,
      round: this.battle.round,
      memoryUsed: this.memoryUsed,
      // a hard card is always spoken: its critical hit is for saying the hard word
      revenge: this.revengeActive || this.hard,
    });
    // listening needs a voice: with the sound off (or no speech synthesis) it is spoken instead
    const audible = sfx.enabled && typeof speechSynthesis !== 'undefined';
    if (kind === 'listen' && !audible) kind = 'speak';
    if (kind === 'listen') {
      const r = listenChoices(this.word, p.level, this.rng);
      if (r) this.listenR = { ...r, wrong: [] };
      else kind = 'speak';
    } else if (kind === 'spell') {
      const r = spellPuzzle(this.word, p.level, this.rng);
      this.spellR = { ...r, got: [], used: r.tiles.map(() => false), bad: r.tiles.map(() => false), mistakes: 0 };
    } else if (kind === 'memory') {
      const cards = memoryDeck(this.word, p.level, this.rng);
      if (cards) {
        this.memR = { cards, open: [], matched: [], misses: 0, lock: false };
        this.memoryUsed = true;
      } else kind = 'speak';
    }
    this.round = kind;
  }

  private render(note = ''): void {
    const hint = this.bossHint();
    if (this.round === 'listen' && this.listenR) {
      return this.view.showListen({ word: this.word, hint: hint ?? '聽聽看，是哪一個？', mode: this.listenR.mode, options: this.listenR.options, wrong: this.listenR.wrong, hard: this.hard, note });
    }
    if (this.round === 'spell' && this.spellR) {
      const s = this.spellR;
      return this.view.showSpell({ word: this.word, hint: hint ?? '把缺的字母補上！', letters: s.letters, blanks: s.blanks, got: s.got, tiles: s.tiles, used: s.used, bad: s.bad, hard: this.hard, note });
    }
    if (this.round === 'memory' && this.memR) {
      return this.view.showMemory({ hint: hint ?? (this.me.level <= 1 ? '翻牌，找出一樣的兩張圖！' : '翻牌，把圖和英文配成一對！'), cards: this.memR.cards, hard: this.hard, note });
    }
    this.view.showWord({
      mode: 'speak',
      word: this.word,
      hint: hint ?? (this.revengeActive ? '再挑戰一次，傷害變大！' : '念出咒語攻擊！'),
      revenge: this.revengeActive,
      hard: this.hard,
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
    const w = this.phase === 'defend' && this.defWord ? this.defWord : this.word;
    sayWord(w.w, this.phase === 'speak' && this.round === 'listen' ? '' : w.zh);
  }

  private mic(): void {
    sfx.unlock();
    stopSay();
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (this.phase === 'speak' && this.round !== 'speak') return;
    if (this.speaker.listening) {
      this.speaker.cancel();
      this.rerender();
      return;
    }
    const w = this.phase === 'defend' && this.defWord ? this.defWord : this.word;
    this.speaker.listen((r) => this.answer(r), [w.w, ...knownHearings(this.save.aliases, w)]);
    // an engine that fails at once has already answered: don't paint 聽著… over its message
    if (!this.speaker.listening) return;
    this.rerender('聽著…');
    this.pollInterim();
  }

  private pollInterim(): void {
    if (!this.speaker.listening) return;
    if (this.speaker.interim) this.view.setNote(`“${this.speaker.interim}”`);
    window.setTimeout(() => this.pollInterim(), 150);
  }

  /** The keyboard button switches between typing and the microphone. */
  private openKeyboard(): void {
    this.speaker.cancel();
    this.typing = !this.typing;
    this.rerender();
  }

  private rerender(note = ''): void {
    if (this.phase === 'defend') this.showDefend(note);
    else if (this.phase === 'speak') this.render(note);
  }

  private answer(r: SpeakResult): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (this.phase === 'speak' && this.round !== 'speak') return;
    const defending = this.phase === 'defend';
    const w = defending && this.defWord ? this.defWord : this.word;
    const lv = this.me.level;
    if (r.kind === 'fail') {
      if (r.reason === 'aborted') return;
      // nothing came back: that still counts as an attempt, or the round could never end
      logHeard({ w: w.w, c: [r.reason], r: 'none', lv, defend: defending });
      this.attempts += 1;
      // no microphone at all: the typing box takes over
      if (r.reason === 'denied' || r.reason === 'unsupported') this.typing = true;
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
    if (this.phase !== 'speak' || this.round !== 'speak') return;
    logHeard({ w: this.word.w, c: this.lastHeard, r: 'skipped', lv: this.me.level });
    this.fail(false);
  }

  /** A grown-up says "they said it right". The engine's transcript is remembered for next time. */
  private confirm(): void {
    if (this.phase !== 'speak' && this.phase !== 'defend') return;
    if (this.phase === 'speak' && this.round !== 'speak') return;
    const defending = this.phase === 'defend';
    const w = defending && this.defWord ? this.defWord : this.word;
    if (this.lastHeard.length) {
      this.save = { ...this.save, aliases: learnHearing(this.save.aliases, w, this.lastHeard, { strict: true }) };
      this.onSave(this.save);
    }
    logHeard({ w: w.w, c: this.lastHeard, r: 'confirmed', lv: this.me.level, defend: defending });
    this.succeed('good', defending);
  }

  // ---- the other kinds of round ------------------------------------------------

  /** Hear it, pick it: the right picture (or meaning) attacks; running out of choices fizzles. */
  private pick(i: number): void {
    const r = this.listenR;
    if (this.phase !== 'speak' || this.round !== 'listen' || !r) return;
    sfx.unlock();
    const o = r.options[i];
    if (!o || r.wrong.includes(o.id)) return;
    if (o.id === this.word.id) {
      this.view.markChoice(i, true);
      this.view.setNote(this.word.w);
      sayWord(this.word.w, '');
      window.setTimeout(() => this.succeed('good', false), 450);
      this.phase = 'strike';
      return;
    }
    r.wrong.push(o.id);
    sfx.play('miss');
    if (r.options.length - r.wrong.length <= 1) return this.fail(false);
    this.render('不是這個，再聽一次！');
    sayWord(this.word.w, '');
  }

  /**
   * Fill in the letters, in any order. A wrong letter is switched off; trying every wrong one fizzles
   * (like running out of choices when listening).
   */
  private tile(i: number): void {
    const s = this.spellR;
    if (this.phase !== 'speak' || this.round !== 'spell' || !s || s.used[i] || s.bad[i]) return;
    sfx.unlock();
    const letter = s.tiles[i];
    const spot = s.blanks.find((b) => !s.got.includes(b) && s.letters[b] === letter);
    if (spot !== undefined) {
      s.used[i] = true;
      s.got.push(spot);
      sfx.play('select');
      if (s.got.length >= s.blanks.length) {
        this.render('拼對了！');
        sayWord(this.word.w, '');
        this.phase = 'strike';
        window.setTimeout(() => this.succeed(s.mistakes === 0 ? 'perfect' : 'good', false), 600);
        return;
      }
      return this.render();
    }
    s.bad[i] = true;
    s.mistakes += 1;
    sfx.play('miss');
    this.view.shakeTile(i);
    if (s.mistakes >= s.tiles.length - s.blanks.length) return this.fail(false);
    window.setTimeout(() => { if (this.spellR === s && this.phase === 'speak') this.render('再想想看！'); }, 300);
  }

  /** Memory: flip two; a match stays up. All three pairs found = a strong attack. */
  private flip(i: number): void {
    const m = this.memR;
    if (this.phase !== 'speak' || this.round !== 'memory' || !m || m.lock) return;
    sfx.unlock();
    const c = m.cards[i];
    if (!c || m.open.includes(i) || m.matched.includes(c.word.id)) return;
    m.open.push(i);
    sayWord(c.word.w, '');
    sfx.play('select');
    this.view.memoryState(m.open, m.matched);
    if (m.open.length < 2) return;
    const [a, b] = m.open.map((k) => m.cards[k]);
    if (a.word.id === b.word.id) {
      m.matched.push(a.word.id);
      m.open = [];
      sfx.play('good');
      this.view.memoryState(m.open, m.matched);
      if (m.matched.length * 2 >= m.cards.length) {
        this.phase = 'strike';
        this.view.setNote('全部配對成功！');
        window.setTimeout(() => this.succeed(m.misses <= MEMORY_PERFECT ? 'perfect' : 'good', false), 650);
      }
      return;
    }
    m.lock = true;
    m.misses += 1;
    window.setTimeout(() => {
      if (this.memR !== m) return;
      m.open = [];
      m.lock = false;
      this.view.memoryState(m.open, m.matched);
    }, 900);
  }

  // ---- growing the partner --------------------------------------------------

  /** A word right: experience for the active partner (none once it is at the top). */
  private gainXp(tier: Tier, hard: boolean): void {
    const m = this.partnerMon(this.me);
    const before = growthOf(this.save.growth, m.id);
    const gs = addXp(this.save.growth, m.id, xpFor(tier === 'perfect' ? 'perfect' : 'good', hard));
    const after = growthOf(gs, m.id);
    if (after.xp === before.xp) return;
    this.save = { ...this.save, growth: gs };
    this.onSave(this.save);
    this.view.floatText('me', `+${after.xp - before.xp} 經驗`, '#7b4fd6', true, 34);
    this.showXp();
    if (isReady(after) && !isReady(before)) {
      sfx.play('starUp', 0);
      this.view.floatText('me', evolvesTo(m.id).length ? '可以進化了！' : '可以升星了！', '#c98600', true, 64);
    }
  }

  /**
   * After a win: every partner whose bar is full evolves (or gains a star). Applied to the save right
   * away (the new form joins the dex and takes the old one's place); the animation follows the catch.
   */
  private growUp(): Grown[] {
    const out: Grown[] = [];
    let gs = this.save.growth ?? {};
    const done = new Set<number>();
    // the further-along form first: Charmeleon → Charizard before Charmander → Charmeleon
    const seats = this.players.map((p, i) => ({ i, id: partnerMon(p, i).id })).sort((a, b) => stageOf(b.id) - stageOf(a.id) || a.i - b.i);
    for (const { i, id } of seats) {
      if (done.has(id)) continue;
      done.add(id);
      const r = takeStep(gs, id, this.rng);
      if (!r) continue;
      gs = r.gs;
      out.push({ seat: i, step: r.step });
    }
    out.sort((a, b) => a.seat - b.seat);
    if (!out.length) return out;
    const evolved = new Map(out.filter((o) => o.step.kind === 'evolve').map((o) => [o.step.from, o.step.to]));
    const players = this.players.map((p, i) => {
      const to = evolved.get(partnerMon(p, i).id);
      return to === undefined ? p : { ...p, mon: to };
    });
    const caught = [...new Set([...this.save.caught, ...evolved.values()])];
    this.save = { ...this.save, growth: gs, players, caught };
    this.battle.players = this.save.players;
    this.onSave(this.save);
    return out;
  }

  /** Play each evolution / star one after another, then carry on. */
  private playGrowth(list: Grown[], done: () => void): void {
    const next = list[0];
    if (!next || this.dead) return done();
    const from = MON_BY_ID.get(next.step.from);
    const to = MON_BY_ID.get(next.step.to);
    if (!from || !to) return this.playGrowth(list.slice(1), done);
    const who = this.players[next.seat]?.name ?? '';
    this.view.showWait(next.step.kind === 'evolve' ? `咦？${who} 的 ${from.name} 的樣子…` : `${who} 的 ${from.name} 在發光…`);
    this.view.evolve(
      { from, to, kind: next.step.kind, stars: next.step.rank },
      (beat, n) => {
        if (this.dead) return;
        if (beat === 'pulse') { sfx.play('evoPulse', n); haptics.pulse(14); }
        if (beat === 'done') {
          this.showXp(next.step.to);
          sfx.play(next.step.kind === 'evolve' ? 'evolveDone' : 'starUp', 1);
          haptics.pulse(next.step.kind === 'evolve' ? [200, 80, 200, 80, 300] : [120, 60, 160]);
          this.view.showWait(next.step.kind === 'evolve' ? `${from.name} 進化成 ${to.name} 了！` : `${from.name} 升星了！${'★'.repeat(next.step.rank)}`);
        }
      },
      () => window.setTimeout(() => this.playGrowth(list.slice(1), done), 900),
    );
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
    if (this.dead) return;
    this.speaker.cancel();
    this.gainXp(tier, !defending && this.hard);
    if (defending) return this.resolveDefense(true, tier === 'perfect' ? 'perfect' : 'good');
    this.phase = 'strike';
    this.cardPlayed = true;
    const sh = this.shield;
    const wasUp = !!sh?.up;
    const outcome = sh ? sh.resolve(!!this.me.adult, this.hasKid()) : 'hit';
    const partner = this.partnerMon(this.me);
    const fx = typeOf(partner).fx;
    const crit = this.hard && outcome !== 'bounce';
    const power = tier === 'perfect' || crit ? 2 : 1;
    this.learned.push(this.word);
    this.view.showWait(outcome === 'bounce' ? '護盾擋住了！' : crit ? '必殺！' : tier === 'perfect' ? '完美！' : '很好！');
    sfx.play(tier === 'perfect' ? 'perfect' : 'good');
    if (crit) {
      this.view.crit();
      sfx.play('crit');
      haptics.pulse([40, 30, 90]);
    }

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

    const mult = (this.revengeActive ? REVENGE_MULT : 1) * (crit ? CRIT_MULT : 1);
    const res = this.battle.attack(this.word, tier, mult);
    if (wasUp && this.battle.monster.hp <= 0) { this.battle.monster.hp = 1; res.killed = false; }
    this.mark(this.word, true, tier, res.damage);
    sfx.cast(fx.style);
    this.view.cast('me', fx.style, fx.colors, power, () => {
      sfx.play('hit', power === 2 ? 4 : 2);
      this.view.hurt('foe');
      if (crit) this.view.shake(12, 420);
      this.view.floatText('foe', crit ? `必殺！ -${res.damage}` : `-${res.damage}`, crit ? '#e0701a' : '#ff5a5a');
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
    if (this.dead) return;
    this.speaker.cancel();
    this.mark(defending && this.defWord ? this.defWord : this.word, false);
    if (defending) return this.resolveDefense(false);
    // no more taps or answers while the fizzle plays out
    this.phase = 'strike';
    this.cardPlayed = true;
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
    // a tab in the background (or a slow phone) must not eat the clock: at most a quarter second per tick
    this.defLeft -= Math.min(0.25, (now - this.lastTick) / 1000);
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
    // while the shield is up a grown-up's reflected hit bounces off it too (the block itself still works)
    const sh = this.shield;
    const bounced = !!sh?.up && !!this.me.adult && this.hasKid();
    const res = this.battle.defend(ok, kind ? (bounced ? 0 : DEFENSE[kind].mult) : 1);
    // and nothing finishes a creature whose shield is still up
    if (sh?.up && res.killed) { this.battle.monster.hp = 1; res.killed = false; }
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

  /** 逃走 asks first (a stray tap must not throw away half a boss fight); the clock waits meanwhile. */
  private askLeave(): void {
    if (this.dead) return;
    if (this.phase === 'victory' || this.phase === 'lost') return this.leaveNow();
    const wasDefending = this.phase === 'defend' && this.timerId !== null;
    this.stopTimer();
    this.speaker.cancel();
    stopSay();
    this.view.confirmLeave(
      () => this.leaveNow(),
      () => {
        if (this.dead) return;
        if (wasDefending && this.phase === 'defend') {
          this.lastTick = performance.now();
          this.timerId = window.setInterval(() => this.tick(), 100);
        }
        this.rerender();
      },
    );
  }

  private leaveNow(): void {
    this.stopTimer();
    this.speaker.cancel();
    stopSay();
    this.onLeave();
  }

  /** Leave the screen: stop timers and the microphone. */
  dispose(): void {
    this.dead = true;
    this.view.dispose();
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
    sfx.setMusic(null);
    this.view.clearFoe();
    const seen = new Set<string>();
    const words = this.learned.filter((w) => !seen.has(w.id) && seen.add(w.id));
    // the win first (so "new to the dex" is judged before any evolution joins it), then growth;
    // the screen merges what the controller writes, so neither undoes the other
    const r = this.onWin(this.foe, words);
    const grown = this.growUp();
    const g = this.grade;
    const gi = g === 'legend' ? 2 : g === 'rare' ? 1 : 0;
    this.view.capture(
      { grade: g, isNew: !!r?.isNew },
      (b) => {
        if (this.dead) return;
        sfx.play(b.kind === 'suck' ? 'catchSuck' : b.kind === 'wobble' ? 'catchWobble' : 'catchLock', b.kind === 'wobble' ? b.n - 1 : gi);
        haptics.pulse(vibrationFor(b.kind, g));
      },
      () => {
        if (this.dead) return;
        this.playGrowth(grown, () => {
          if (this.dead) return;
          if (grown.length) this.refreshParty();
          sfx.play('win');
          const lines = grown.map((x) => {
            const from = MON_BY_ID.get(x.step.from)?.name ?? '';
            const to = MON_BY_ID.get(x.step.to)?.name ?? '';
            return x.step.kind === 'evolve' ? `${from} 進化成 ${to}` : `${from} 升到 ${'★'.repeat(x.step.rank)}`;
          });
          this.view.showVictory(this.foe, words, { ...(r ? { isNew: r.isNew, nextLabel: r.nextLabel } : {}), grown: lines });
        });
      },
    );
  }

}
