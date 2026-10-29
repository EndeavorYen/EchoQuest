/**
 * A rolling log of what the speech engine returned for each attempt, kept on the device
 * only. A parent can copy it (PARTY screen) and send it along so the matching can be
 * tuned on real voices instead of guesses.
 *
 * Records are never deleted by exporting. Every export starts with a stamped header
 * (when, which export, a unique id, what scope and how many), so whoever receives it can
 * tell which exports have already been dealt with; sending the same records twice is harmless.
 */
export type HeardResult =
  | 'perfect'
  | 'good'
  | 'miss'
  /** a grown-up (or the child) pressed "I said it right" */
  | 'confirmed'
  /** defending, the engine could not make it out twice: let through as a plain block */
  | 'rescued'
  /** stuck on an attack word, the player chose to skip it */
  | 'skipped'
  /** the engine returned nothing at all (c holds the reason) */
  | 'none';

export interface HeardEntry {
  /** running number, so "new since the last export" is exact */
  n?: number;
  /** the word we asked for */
  w: string;
  /** what the engine returned, best first (for `none`: the reason) */
  c: string[];
  /** how it was judged */
  r: HeardResult;
  /** player level when it happened */
  lv: number;
  /** unix seconds */
  t: number;
  /** 1 when the wanted word is a very short sound (bee, she…), the kind engines drop */
  s?: 1;
  /** 1 when it happened in the defence round */
  d?: 1;
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'echoquest.heard';
const SEQ_KEY = 'echoquest.heard.seq';
const EXPORTS_KEY = 'echoquest.heard.exports';
export const MAX_LOG = 500;

/** Words this short are easily swallowed by a recogniser ("B", "she", "go"). */
export function isShortSound(word: string): boolean {
  return word.replace(/[^a-z]/gi, '').length <= 3;
}

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

function readNum(s: StorageLike, key: string): number {
  const v = Number(s.getItem(key));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function logHeard(
  e: Omit<HeardEntry, 't' | 'n' | 's' | 'd'> & { defend?: boolean },
  s: StorageLike | null = store(),
  now = Date.now(),
): void {
  if (!s) return;
  try {
    const log = readLog(s);
    const n = Math.max(readNum(s, SEQ_KEY), log.reduce((m, x) => Math.max(m, x.n ?? 0), 0)) + 1;
    const { defend, ...rest } = e;
    const entry: HeardEntry = { n, ...rest, c: e.c.slice(0, 5), t: Math.round(now / 1000) };
    if (isShortSound(e.w)) entry.s = 1;
    if (defend) entry.d = 1;
    log.push(entry);
    s.setItem(KEY, JSON.stringify(log.slice(-MAX_LOG)));
    s.setItem(SEQ_KEY, String(n));
  } catch {
    // logging is a nicety; never get in the way of playing
  }
}

// ---- export -------------------------------------------------------------------

export type ExportScope = 'new' | 'all';

export interface ExportState {
  /** how many exports have been committed so far */
  count: number;
  /** the highest record number already included in an export */
  seq: number;
}

export function readExportState(s: StorageLike | null = store()): ExportState {
  if (!s) return { count: 0, seq: 0 };
  try {
    const v = JSON.parse(s.getItem(EXPORTS_KEY) ?? '{}');
    return { count: Number(v.count) > 0 ? Number(v.count) : 0, seq: Number(v.seq) > 0 ? Number(v.seq) : 0 };
  } catch {
    return { count: 0, seq: 0 };
  }
}

/** How many records have not been in any export yet. */
export function pendingCount(s: StorageLike | null = store()): number {
  const { seq } = readExportState(s);
  return readLog(s).filter((x) => (x.n ?? 0) > seq).length;
}

export interface LogExport {
  /** the whole text to put on the clipboard */
  text: string;
  /** unique id of this export, e.g. EQ-20261029-1432-K7QF */
  id: string;
  /** which export this is (1st, 2nd…) */
  number: number;
  scope: ExportScope;
  /** records in it */
  count: number;
  /** highest record number in it (what "committed" will move the marker to) */
  upTo: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** The local date-time as "2026-10-29 14:32 (UTC+8)". */
export function stamp(now: number): { human: string; compact: string } {
  const d = new Date(now);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh = Math.floor(Math.abs(off) / 60);
  const mm = Math.abs(off) % 60;
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    human: `${date} ${time} (UTC${sign}${hh}${mm ? ':' + pad(mm) : ''})`,
    compact: `${date.replace(/-/g, '')}-${time.replace(':', '')}`,
  };
}

/**
 * Build the text for one export without touching the marker: the marker moves only once the
 * copy really worked (`commitExport`), so a failed copy loses nothing.
 */
export function buildExport(
  scope: ExportScope,
  version: string,
  s: StorageLike | null = store(),
  now = Date.now(),
  rand: () => number = Math.random,
): LogExport {
  const st = readExportState(s);
  const all = readLog(s);
  const picked = scope === 'all' ? all : all.filter((x) => (x.n ?? 0) > st.seq);
  const number = st.count + 1;
  const tag = Array.from({ length: 4 }, () => ID_CHARS[Math.floor(rand() * ID_CHARS.length) % ID_CHARS.length]).join('');
  const id = `EQ-${stamp(now).compact}-${tag}`;
  const upTo = all.reduce((m, x) => Math.max(m, x.n ?? 0), st.seq);
  const head = [
    '# EchoQuest 辨識回報',
    `ID: ${id}`,
    `匯出: 第 ${number} 次　時間: ${stamp(now).human}`,
    `範圍: ${scope === 'all' ? '全部紀錄' : '上次匯出之後的新紀錄'}　筆數: ${picked.length}　版本: ${version}`,
    '欄位: n=流水號 w=要念的字 c=辨識結果 r=判定(perfect/good/miss/confirmed=按了我念對了/rescued=防禦保底/skipped=跳過/none=沒聽到) lv=等級 t=時間 s=極短音 d=防禦',
    '---',
  ];
  return { text: [...head, ...picked.map((x) => JSON.stringify(x))].join('\n'), id, number, scope, count: picked.length, upTo };
}

/** Remember that this export was handed over. Records themselves stay on the device. */
export function commitExport(e: LogExport, s: StorageLike | null = store()): void {
  if (!s) return;
  try {
    const st = readExportState(s);
    s.setItem(EXPORTS_KEY, JSON.stringify({ count: Math.max(st.count, e.number), seq: Math.max(st.seq, e.upTo) }));
  } catch {
    // ignore
  }
}

/** Plain JSON of every record (used by the old classic game's copy button). */
export function exportLog(s: StorageLike | null = store()): string {
  return JSON.stringify(readLog(s));
}
