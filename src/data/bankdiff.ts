import type { Word } from './bank';
import { fingerprint, type Snapshot } from './fingerprint';
import type { LedgerRev } from './ledger';
import type { Issue } from './validate';

export type Change = Omit<LedgerRev, 'rev' | 'date' | 'note'>;

export const snapshotOf = (rev: number, words: Word[]): Snapshot => ({
  rev,
  words: Object.fromEntries(words.map((w) => [w.id, fingerprint(w)]).sort(([a], [b]) => (a < b ? -1 : 1))),
});

/** What differs between the committed snapshot and the packs as they are now. */
export function diffBank(snap: Snapshot, words: Word[]): { change: Change; problems: Issue[] } {
  const change: Change = { add: [], move: [], retire: [], revise: [] };
  const problems: Issue[] = [];
  const now = new Map(words.map((w) => [w.id, w]));
  for (const id of Object.keys(snap.words)) {
    if (!now.has(id)) {
      problems.push({ where: id, rule: 'deleted', msg: 'was in the bank at the last commit but is gone. Never delete a word: mark it "retired": true (and "replacedBy" if another word takes its place)' });
    }
  }
  for (const w of words) {
    const before = snap.words[w.id];
    if (before === undefined) {
      change.add.push(w.id);
      if (w.retired) problems.push({ where: w.id, rule: 'retired-new', msg: 'a new word cannot start out retired' });
    } else if (before !== fingerprint(w)) {
      // was it living before? the snapshot can't say, so a retired word with a replacement is a move, without one a retire
      if (w.retired && w.replacedBy) change.move.push([w.id, w.replacedBy]);
      else if (w.retired) change.retire.push(w.id);
      else change.revise.push(w.id);
    }
  }
  return { change, problems };
}

export const isEmpty = (c: Change): boolean => !c.add.length && !c.move.length && !c.retire.length && !c.revise.length;
