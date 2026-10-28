import { WORDS, type Word } from '../data/words';
import { priority } from './progress';
import type { Level, Player } from './model';
import { Rng } from '../util/rng';

export type CardTag = 'easy' | 'mid' | 'hard';

export interface Card {
  word: Word;
  tag: CardTag;
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
 * Three spell cards: easier / on-level / harder than the player.
 * Harder words hit harder — the player decides how brave to be.
 */
export function pickCards(player: Player, now: number, rng: Rng, recent: string[] = []): Card[] {
  const L = player.level;
  const tiers: Array<[Level, CardTag]> =
    L === 1 ? [[1, 'easy'], [1, 'mid'], [2, 'hard']]
      : L === 4 ? [[3, 'easy'], [4, 'mid'], [4, 'hard']]
        : [[(L - 1) as Level, 'easy'], [L, 'mid'], [(L + 1) as Level, 'hard']];
  const avoid = new Set(recent);
  const cards: Card[] = [];
  for (const [lv, tag] of tiers) {
    const w = pickFrom(player, lv, now, rng, avoid);
    if (!w) continue;
    avoid.add(w.id);
    cards.push({ word: w, tag });
  }
  return cards;
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
