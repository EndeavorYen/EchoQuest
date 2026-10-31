import { WORDS, type Word } from '../data/words';
import type { Rng } from '../util/rng';

/**
 * Not every attack is "say the word". Now and then the round is a different little game with the
 * same word: hear it and pick the picture, fill in the missing letters, or a memory match.
 * Speaking stays the main thing; the others are switched on or off in the party settings.
 */
export type RoundType = 'speak' | 'listen' | 'spell' | 'memory';

export interface RoundPrefs {
  listen: boolean;
  spell: boolean;
  memory: boolean;
}

export const DEFAULT_ROUNDS: RoundPrefs = { listen: true, spell: true, memory: true };

export function roundPrefs(saved?: Partial<RoundPrefs>): RoundPrefs {
  return { ...DEFAULT_ROUNDS, ...saved };
}

/** A forced round type (tests and `?debug&rounds=…`): used whenever the word allows it. */
let forced: RoundType | null = null;
export function forceRound(t: RoundType | null): void {
  forced = t;
}

/** Chance of each kind on an ordinary attack card (memory at most once a fight). */
export const ODDS = { memory: 0.12, listen: 0.25, spell: 0.15 } as const;

const plain = (w: Word): string => w.w.toLowerCase();

/** Words a child cannot tell apart by ear (the bank has others spelled alike: fly 🦅 / fly 🪰). */
const SOUND_ALIKE = [
  ['sun', 'son'], ['sea', 'see'], ['red', 'read'], ['eye', 'i'], ['two', 'too', 'to'], ['four', 'for'], ['eight', 'ate'],
  ['here', 'hear'], ['no', 'know'], ['right', 'write'], ['meat', 'meet'], ['flower', 'flour'], ['pear', 'pair'],
  ['bee', 'be'], ['tail', 'tale'], ['sail', 'sale'], ['night', 'knight'], ['one', 'won'], ['blue', 'blew'],
  ['by', 'buy', 'bye'], ['deer', 'dear'], ['hole', 'whole'], ['mail', 'male'], ['road', 'rode'], ['week', 'weak'],
  ['wear', 'where'], ['wood', 'would'], ['hour', 'our'], ['piece', 'peace'], ['plane', 'plain'], ['rain', 'reign'],
  ['bear', 'bare'], ['tea', 'tee'], ['ant', 'aunt'], ['knot', 'not'], ['knows', 'nose'], ['so', 'sew'], ['tie', 'thai'],
];
const ALIKE = new Map(SOUND_ALIKE.flatMap((g) => g.map((w) => [w, g] as const)));

/** Same spelling, or a known sound-alike: never two of these among the choices. */
export function soundsAlike(a: Word, b: Word): boolean {
  const x = plain(a);
  const y = plain(b);
  return x === y || !!ALIKE.get(x)?.includes(y);
}

/** Up to lower primary the choices are pictures (a 6-year-old cannot read 「舒服的、舒適的」 yet). */
export function canListen(word: Word, level: number): boolean {
  return level >= 3 || !!word.icon;
}

/** Spelling is for readers, on plain short words (no spaces or apostrophes). */
export function canSpell(word: Word, level: number): boolean {
  return level >= 2 && /^[a-z]{3,8}$/.test(plain(word));
}

/** Memory needs a picture to match. */
export function canMemory(word: Word): boolean {
  return !!word.icon;
}

function feasible(t: RoundType, word: Word, level: number): boolean {
  if (t === 'listen') return canListen(word, level);
  if (t === 'spell') return canSpell(word, level);
  if (t === 'memory') return canMemory(word);
  return true;
}

export function chooseRound(o: {
  rng: Rng;
  prefs: RoundPrefs;
  level: number;
  word: Word;
  /** the fight's exchange number; the first one is always spoken */
  round: number;
  memoryUsed: boolean;
  /** a revenge card is always spoken */
  revenge: boolean;
}): RoundType {
  if (forced) return feasible(forced, o.word, o.level) ? forced : 'speak';
  if (o.revenge || o.round <= 1) return 'speak';
  const { prefs, word, level, rng } = o;
  if (prefs.memory && !o.memoryUsed && canMemory(word) && rng.next() < ODDS.memory) return 'memory';
  const r = rng.next();
  if (prefs.listen && canListen(word, level) && r < ODDS.listen) return 'listen';
  if (prefs.spell && canSpell(word, level) && r >= ODDS.listen && r < ODDS.listen + ODDS.spell) return 'spell';
  return 'speak';
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1)) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistinct(pool: Word[], n: number, rng: Rng, clash: (a: Word, b: Word) => boolean, taken: Word[]): Word[] {
  const out: Word[] = [];
  for (const w of shuffle(pool, rng)) {
    if (out.length >= n) break;
    if ([...taken, ...out].some((t) => t.id === w.id || clash(t, w))) continue;
    out.push(w);
  }
  return out;
}

// ---- hear it, pick it ----------------------------------------------------------

export interface ListenRound {
  /** pictures when the word has one; otherwise the Chinese meanings */
  mode: 'pic' | 'zh';
  options: Word[];
}

/** Two choices for the youngest, three for everyone else. Null when there are not enough look-alikes. */
export function listenChoices(word: Word, level: number, rng: Rng, pool: readonly Word[] = WORDS): ListenRound | null {
  const n = level <= 1 ? 2 : 3;
  const usable = pool.filter((w) => !w.retired);
  if (word.icon) {
    const near = usable.filter((w) => w.icon && w.lv <= Math.max(2, level + 1));
    const others = pickDistinct(near, n - 1, rng, (a, b) => a.icon === b.icon || a.zh === b.zh || soundsAlike(a, b), [word]);
    if (others.length === n - 1) return { mode: 'pic', options: shuffle([word, ...others], rng) };
  }
  if (level <= 2) return null;
  const same = usable.filter((w) => w.lv === word.lv);
  // meanings that share a character ("幫助" / "輔助的") are too close to tell apart by ear
  const han = (w: Word): Set<string> => new Set(w.zh.replace(/[的地得之、，,;；（）()\s]/g, '').split(''));
  const overlap = (a: Word, b: Word): boolean => {
    if (soundsAlike(a, b)) return true;
    const ha = han(a);
    return [...han(b)].some((c) => ha.has(c));
  };
  const others = pickDistinct(same, n - 1, rng, overlap, [word]);
  return others.length === n - 1 ? { mode: 'zh', options: shuffle([word, ...others], rng) } : null;
}

// ---- fill in the letters --------------------------------------------------------

export interface SpellRound {
  letters: string[];
  /** indexes of the missing letters, left to right */
  blanks: number[];
  /** letters to choose from: the missing ones and a few others, shuffled */
  tiles: string[];
}

const ABC = 'abcdefghijklmnopqrstuvwxyz';

/** One missing letter at level 2 (never the first), two at level 3, three at level 4. */
export function spellPuzzle(word: Word, level: number, rng: Rng): SpellRound {
  const letters = plain(word).split('');
  const count = Math.max(1, Math.min(letters.length - 1, level - 1));
  const spots = shuffle(letters.map((_, i) => i).filter((i) => level > 2 || i > 0), rng).slice(0, count).sort((a, b) => a - b);
  const missing = spots.map((i) => letters[i]);
  const decoys = shuffle(ABC.split('').filter((c) => !letters.includes(c)), rng).slice(0, 2);
  return { letters, blanks: spots, tiles: shuffle([...missing, ...decoys], rng) };
}

// ---- memory match ---------------------------------------------------------------

export interface MemoryCard {
  word: Word;
  /** a picture, or the English word (readers match picture to word) */
  face: 'pic' | 'word';
}

/** Three pairs: the dealt word and two more with pictures. Non-readers match picture to picture. */
export function memoryDeck(word: Word, level: number, rng: Rng, pool: readonly Word[] = WORDS): MemoryCard[] | null {
  if (!word.icon) return null;
  const near = pool.filter((w) => !w.retired && w.icon && w.lv <= Math.max(1, level));
  const others = pickDistinct(near, 2, rng, (a, b) => a.icon === b.icon || soundsAlike(a, b), [word]);
  if (others.length < 2) return null;
  const cards = [word, ...others].flatMap((w): MemoryCard[] => [
    { word: w, face: 'pic' },
    { word: w, face: level <= 1 ? 'pic' : 'word' },
  ]);
  return shuffle(cards, rng);
}
