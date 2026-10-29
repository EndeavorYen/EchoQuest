import type { Save } from './save';
import type { LedgerRev } from '../data/ledger';
import type { Progress, WordProgress } from './progress';

/** Two records of the same word became one: keep the better mastery and add up the history. */
export function mergeProgress(a: WordProgress, b: WordProgress): WordProgress {
  const best = a.mastery !== b.mastery ? (a.mastery > b.mastery ? a : b) : a.lastAt >= b.lastAt ? a : b;
  return {
    attempts: a.attempts + b.attempts,
    correct: a.correct + b.correct,
    misses: a.misses + b.misses,
    streak: best.streak,
    mastery: best.mastery,
    lastAt: Math.max(a.lastAt, b.lastAt),
    dueAt: best.dueAt,
  };
}

function moveKey<T>(rec: Record<string, T>, from: string, to: string, merge: (a: T, b: T) => T): Record<string, T> {
  if (!(from in rec) || from === to) return rec;
  const out = { ...rec };
  const v = out[from];
  delete out[from];
  out[to] = to in out ? merge(out[to], v) : v;
  return out;
}

function moveId(ids: string[], from: string, to: string): string[] {
  if (!ids.includes(from)) return ids;
  const out = ids.filter((x) => x !== from);
  if (!out.includes(to)) out.push(to);
  return out;
}

/**
 * Bring a save up to the bank revision this build ships by replaying the ledger.
 *
 *  - Idempotent: a save already at `appRev` is returned untouched.
 *  - Never goes backwards: a save from a newer build (rev > appRev) is left alone, since
 *    its word ids may be ones this build doesn't know yet.
 *  - Only `move` changes touch data. Retired words keep their progress (it's just ignored),
 *    unknown ids are never deleted.
 */
export function reconcile(save: Save, ledger: readonly LedgerRev[], appRev: number): Save {
  const from = save.bankRev ?? 0;
  if (from >= appRev) return from === save.bankRev ? save : { ...save, bankRev: from };
  let { collection, aliases } = save;
  let players = save.players;
  for (const rev of ledger) {
    if (rev.rev <= from || rev.rev > appRev) continue;
    for (const [a, b] of rev.move) {
      collection = moveId(collection, a, b);
      aliases = moveKey(aliases, a, b, (x, y) => [...new Set([...x, ...y])]);
      players = players.map((p) => {
        if (!(a in p.progress)) return p;
        const progress: Progress = moveKey(p.progress, a, b, mergeProgress);
        return { ...p, progress };
      });
    }
  }
  return { ...save, collection, aliases, players, bankRev: appRev };
}
