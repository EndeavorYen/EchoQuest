/**
 * Per-player word mastery with a tiny spaced-repetition schedule.
 * Words a player misses come back sooner; words they keep getting right rest.
 */
export type Mastery = 0 | 1 | 2 | 3;

export interface WordProgress {
  attempts: number;
  correct: number;
  misses: number;
  streak: number;
  mastery: Mastery;
  lastAt: number;
  dueAt: number;
}

export type Progress = Record<string, WordProgress>;

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const DELAY: Record<Mastery, number> = { 0: HOUR / 2, 1: DAY, 2: 3 * DAY, 3: 7 * DAY };

export function record(progress: Progress, wordId: string, ok: boolean, now: number): Progress {
  const prev: WordProgress = progress[wordId] ?? {
    attempts: 0, correct: 0, misses: 0, streak: 0, mastery: 0, lastAt: 0, dueAt: 0,
  };
  const streak = ok ? prev.streak + 1 : 0;
  const mastery = (ok ? Math.min(3, streak) : 0) as Mastery;
  return {
    ...progress,
    [wordId]: {
      attempts: prev.attempts + 1,
      correct: prev.correct + (ok ? 1 : 0),
      misses: prev.misses + (ok ? 0 : 1),
      streak,
      mastery,
      lastAt: now,
      dueAt: ok ? now + DELAY[mastery] : now,
    },
  };
}

/** Lower = needs practice sooner. Unseen words sit between due and mastered ones. */
export function priority(progress: Progress, wordId: string, now: number): number {
  const p = progress[wordId];
  if (!p) return 2;
  if (p.dueAt <= now) return p.misses > 0 && p.mastery === 0 ? 0 : 1;
  return 3 + p.mastery;
}

export function summary(progress: Progress, now: number): { seen: number; mastered: number; due: number } {
  const items = Object.values(progress).filter((p) => p.attempts > 0);
  return {
    seen: items.length,
    mastered: items.filter((p) => p.mastery >= 3).length,
    due: items.filter((p) => p.dueAt <= now).length,
  };
}

export interface LevelStat {
  total: number;
  /** tried at least once */
  seen: number;
  /** got right at least once since the last miss */
  learned: number;
  /** got right three times in a row (rests for a week) */
  mastered: number;
}

/** How a player is doing within one difficulty band. Derived, never stored, so it can't drift from the word bank. */
export function levelStat(progress: Progress, words: readonly { id: string; lv: number }[], lv: number): LevelStat {
  const inLevel = words.filter((w) => w.lv === lv);
  let seen = 0;
  let learned = 0;
  let mastered = 0;
  for (const w of inLevel) {
    const p = progress[w.id];
    if (!p || p.attempts === 0) continue;
    seen += 1;
    if (p.mastery >= 1) learned += 1;
    if (p.mastery >= 3) mastered += 1;
  }
  return { total: inLevel.length, seen, learned, mastered };
}
