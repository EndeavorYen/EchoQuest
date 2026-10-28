import { WORDS, type Word } from '../data/words';
import { priority } from './progress';
import type { Player } from './model';
import { Rng } from '../util/rng';

/** The spell word a player is dealt. */
export interface Card {
  word: Word;
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
export function dealCard(player: Player, now: number, rng: Rng, recent: string[] = []): Card {
  const word =
    pickFrom(player, player.level, now, rng, new Set(recent)) ??
    pickFrom(player, 1, now, rng, new Set()) ??
    WORDS[0];
  return { word };
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
