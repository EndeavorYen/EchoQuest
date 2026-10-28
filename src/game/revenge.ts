import type { Word } from '../data/words';

/** Damage bonus for beating a word that got away earlier in the same battle. */
export const REVENGE_MULT = 1.5;

/** How many exchanges later a missed word comes back. */
export const REVENGE_GAP = 2;

interface Entry { pid: string; word: Word; due: number }

/**
 * Words a player missed in this battle come back a couple of rounds later, so
 * a miss turns into "I'll get you next time!" instead of a dead end.
 * (Long-term repetition is handled by the spaced-repetition progress.)
 */
export class Revenge {
  private q: Entry[] = [];

  /** Remember a missed word for this player. Missing it again just pushes it back. */
  miss(pid: string, word: Word, round: number, gap = REVENGE_GAP): void {
    this.q = this.q.filter((e) => !(e.pid === pid && e.word.id === word.id));
    this.q.push({ pid, word, due: round + gap });
  }

  /** The oldest due word for this player, removed from the queue; null if none is due yet. */
  take(pid: string, round: number): Word | null {
    const i = this.q.findIndex((e) => e.pid === pid && e.due <= round);
    if (i < 0) return null;
    return this.q.splice(i, 1)[0].word;
  }

  /** Something is waiting for this player (due or not). */
  pending(pid: string): number {
    return this.q.filter((e) => e.pid === pid).length;
  }
}
