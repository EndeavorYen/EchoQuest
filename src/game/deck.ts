import { WORDS, type Word } from '../data/words';
import { priority } from './progress';
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
    pickFrom(player, lv, now, rng, new Set(recent)) ??
    pickFrom(player, 1, now, rng, new Set()) ??
    WORDS[0];
  return { word };
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
      ? pickFrom(player, player.level + 1, now, rng, avoid)
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

/** A short, easy word for the shield spell (one level below, never long). */
export function pickDefenseWord(player: Player, now: number, rng: Rng, recent: string[] = []): Word {
  const lv = Math.max(1, player.level - 1);
  const avoid = new Set(recent);
  return (
    pickFrom(player, lv, now, rng, avoid, (w) => w.w.length <= 7) ??
    pickFrom(player, lv, now, rng, avoid) ??
    WORDS[0]
  );
}

/** Words for practice mode, weakest first. */
export function pickPractice(player: Player, lv: number, now: number, rng: Rng, recent: string[]): Word {
  return pickFrom(player, lv, now, rng, new Set(recent)) ?? WORDS[0];
}
