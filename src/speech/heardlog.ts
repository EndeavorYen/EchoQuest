/**
 * A small rolling log of what the speech engine returned for each attempt, kept
 * on the device only. A parent can copy it (PARTY screen) and send it along so the
 * matching can be tuned on real voices instead of guesses.
 */
export interface HeardEntry {
  /** the word we asked for */
  w: string;
  /** what the engine returned, best first */
  c: string[];
  /** how it was judged */
  r: 'perfect' | 'good' | 'miss' | 'confirmed';
  /** player level when it happened */
  lv: number;
  /** unix seconds */
  t: number;
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'echoquest.heard';
export const MAX_LOG = 300;

function store(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLog(s: StorageLike | null = store()): HeardEntry[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function logHeard(e: Omit<HeardEntry, 't'>, s: StorageLike | null = store(), now = Date.now()): void {
  if (!s) return;
  try {
    const log = readLog(s);
    log.push({ ...e, c: e.c.slice(0, 5), t: Math.round(now / 1000) });
    s.setItem(KEY, JSON.stringify(log.slice(-MAX_LOG)));
  } catch {
    // logging is a nicety; never get in the way of playing
  }
}

/** Compact text a parent can paste into a message. */
export function exportLog(s: StorageLike | null = store()): string {
  return JSON.stringify(readLog(s));
}
