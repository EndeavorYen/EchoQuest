import { WORDS, type Word } from '../data/words';
import { levelStat, priority } from './progress';
import type { Player } from './model';
import { Rng } from '../util/rng';
import { hardChance } from '../mon/growth';

/** The spell word a player is dealt. */
export interface Card {
  word: Word;
  /** a harder word than usual (a raised partner draws these); right = a critical hit */
  hard?: boolean;
}

function pickFrom(
  player: Player,
  lv: number,
  now: number,
  rng: Rng,
  avoid: Set<string>,
  filter?: (w: Word) => boolean,
): Word | null {
  const pool = WORDS.filter((w) => w.lv === lv && (!filter || filter(w)));
  const fresh = pool.filter((w) => !avoid.has(w.id));
  const list = fresh.length ? fresh : pool;
  if (!list.length) return null;
  // words that need practice float to the top; jitter keeps it from being predictable
  const ranked = list
    .map((w) => ({ w, s: priority(player.progress, w.id, now) + rng.next() * 1.6 }))
    .sort((a, b) => a.s - b.s);
  return ranked[0].w;
}

/**
 * Deal one spell at the player's own difficulty. Words the player is still
 * learning (or has missed) come first; `recent` keeps repeats away.
 */
export function dealCard(player: Player, now: number, rng: Rng, recent: string[] = [], lv: number = player.level): Card {
  const word =
    // the youngest cannot read the card: a picture is what tells them the word
    (player.level <= 1 ? pickFrom(player, lv, now, rng, new Set(recent), hasPicture) : null) ??
    (lv === 2 && onRamp(player) ? pickFrom(player, lv, now, rng, new Set(recent), onRamp(player)!) : null) ??
    pickFrom(player, lv, now, rng, new Set(recent)) ??
    pickFrom(player, 1, now, rng, new Set()) ??
    WORDS[0];
  return { word };
}

const hasPicture = (w: Word): boolean => !!w.icon;

/** Level 2 has 2,000+ words, most without a picture: a newcomer starts small. */
export const RAMP_PICTURES = 40;
export const RAMP_A1 = 120;

/**
 * The words a level-2 player is ready for: picture words until they have learned RAMP_PICTURES level-2
 * words, then picture words and the easiest list (CEFR A1) until RAMP_A1, then everything.
 */
export function onRamp(player: Player): ((w: Word) => boolean) | null {
  if (player.level !== 2) return null;
  const learned = levelStat(player.progress, WORDS, 2).learned;
  // a word they have already met (and maybe missed) always stays in the pool so it can come back
  const met = (w: Word): boolean => !!player.progress[w.id];
  if (learned < RAMP_PICTURES) return (w) => hasPicture(w) || met(w);
  if (learned < RAMP_A1) return (w) => hasPicture(w) || w.cefr === 'A1' || met(w);
  return null;
}

/** Letters only, for length checks ("ice cream" → 8). */
const letters = (w: Word): number => w.w.replace(/[^a-z]/gi, '').length;

/**
 * A hard card: a word one level up; a level-4 player (there is no level 5) gets a long level-4 word.
 * Falls back to an ordinary card when there is nothing suitable.
 */
export function dealHardCard(player: Player, now: number, rng: Rng, recent: string[] = []): Card {
  const avoid = new Set(recent);
  const word =
    player.level < 4
      ? (player.level <= 1 ? pickFrom(player, 2, now, rng, avoid, hasPicture) : null) ?? pickFrom(player, player.level + 1, now, rng, avoid)
      : pickFrom(player, 4, now, rng, avoid, (w) => letters(w) >= 8);
  return word ? { word, hard: true } : dealCard(player, now, rng, recent);
}

/**
 * Should the next card be a hard one? The chance grows with the partner's rank, and there is never
 * more than one hard card in any three in a row (`history`: were the last cards hard, oldest first).
 */
export function rollHard(rank: number, history: readonly boolean[], rng: Rng): boolean {
  if (history.slice(-2).some(Boolean)) return false;
  const p = hardChance(rank);
  return p > 0 && rng.next() < p;
}

/**
 * The hard-card history after a card is dealt. A re-deal in the same exchange (the party switched
 * player before answering) replaces the last entry, so switching can never sneak in a second hard card.
 */
export function recordHard(history: readonly boolean[], hard: boolean, replaceLast: boolean): boolean[] {
  const base = replaceLast ? history.slice(0, -1) : [...history];
  return [...base, hard].slice(-3);
}

/** A short, easy word for the shield spell (one level below, never long). */
export function pickDefenseWord(player: Player, now: number, rng: Rng, recent: string[] = []): Word {
  const lv = Math.max(1, player.level - 1);
  const avoid = new Set(recent);
  return (
    (player.level <= 1 ? pickFrom(player, lv, now, rng, avoid, (w) => hasPicture(w) && w.w.length <= 7) : null) ??
    pickFrom(player, lv, now, rng, avoid, (w) => w.w.length <= 7) ??
    pickFrom(player, lv, now, rng, avoid) ??
    WORDS[0]
  );
}

/** Words for practice mode, weakest first (with a picture for the youngest). */
export function pickPractice(player: Player, lv: number, now: number, rng: Rng, recent: string[]): Word {
  const ramp = lv === 2 && player.level <= 2 ? onRamp({ ...player, level: 2 }) : null;
  return (
    (lv <= 1 ? pickFrom(player, lv, now, rng, new Set(recent), hasPicture) : null) ??
    (ramp ? pickFrom(player, lv, now, rng, new Set(recent), ramp) : null) ??
    pickFrom(player, lv, now, rng, new Set(recent)) ??
    WORDS[0]
  );
}
