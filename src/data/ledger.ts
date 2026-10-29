/**
 * The word bank's change history. `bankstate/ledger.json` is append-only and written by
 * `npm run words:commit` — never by hand. Each revision lists what changed; the
 * only changes that matter to a player's save are `moves` (a word's id changed or
 * two words merged). Everything else is history for people.
 */
import ledgerData from './bankstate/ledger.json';

export interface LedgerRev {
  rev: number;
  date: string;
  note: string;
  add: string[];
  /** [from, to]: progress under `from` belongs to `to` from this revision on */
  move: [string, string][];
  /** retired without a replacement: progress is kept but ignored */
  retire: string[];
  /** wording / level / topic / icon changed, id unchanged */
  revise: string[];
}

export const LEDGER: readonly LedgerRev[] = (ledgerData as { revs: LedgerRev[] }).revs;
/** The bank revision this build ships. */
export const BANK_REV = LEDGER.length ? LEDGER[LEDGER.length - 1].rev : 0;
