/**
 * The word bank, assembled from data files in `src/data/packs/*.json`.
 *
 *  - A word's id is stable: `<english word>:<part of speech>` (e.g. `bank:n`,
 *    `bank:v`). It never depends on level or list, so progress survives a word
 *    being re-levelled or added to another list.
 *  - Difficulty (`lv`, a band defined in levels.json) and word lists (`lists`) are
 *    separate things. One word can belong to many lists (starter, MOE 1200, IELTS…).
 *  - Expansion packs are just more JSON files dropped into `packs/`. Only add a
 *    pack whose licence allows it — record that in its `license` field.
 */
import levelData from './levels.json';
import topicData from './topics.json';

export type Lv = 1 | 2 | 3 | 4;
export type Pos = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'det' | 'num' | 'interj' | 'phr';
export const POS_LIST: readonly Pos[] = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'phr'];

export interface Word {
  id: string;
  w: string;
  pos: Pos;
  zh: string;
  lv: Lv;
  icon?: string;
  /** transcripts speech engines are known to return for this word ("egg" → "ag") */
  heard?: string[];
  /** every word list this word belongs to */
  lists: string[];
  /** subject area (an id from topics.json), for browsing and practice */
  topic?: string;
  /** CEFR level of the source list (A1–B2), kept for reference */
  cefr?: string;
  /** soft-deleted: never dealt any more, but the id stays known so old progress isn't orphaned */
  retired?: boolean;
  /** the id that took this word's place (progress moves there on the next save load) */
  replacedBy?: string;
}

export interface PackWord {
  w: string;
  pos: Pos;
  zh: string;
  lv: Lv;
  icon?: string;
  heard?: string[];
  /** extra lists on top of the pack's own */
  lists?: string[];
  topic?: string;
  cefr?: string;
  retired?: boolean;
  replacedBy?: string;
}

export interface Pack {
  id: string;
  name: string;
  /** where the data comes from and why we may ship it */
  license: string;
  /** lists every word of the pack joins */
  lists: string[];
  words: PackWord[];
}

export interface Level {
  lv: Lv;
  name: string;
  en: string;
}

export const LEVELS: readonly Level[] = (levelData.levels as Level[]).slice().sort((a, b) => a.lv - b.lv);
export const MIN_LV = LEVELS[0].lv;
export const MAX_LV = LEVELS[LEVELS.length - 1].lv;

export function wordId(w: string, pos: string): string {
  return `${w.trim().toLowerCase()}:${pos}`;
}

const isLv = (n: unknown): n is Lv => typeof n === 'number' && LEVELS.some((l) => l.lv === n);

/**
 * Merge packs into one bank. Bad entries are skipped rather than crashing the
 * game; a word that appears in several packs keeps its first definition and
 * collects every list.
 */
export function buildBank(packs: Pack[]): Word[] {
  const byId = new Map<string, Word>();
  for (const pack of packs) {
    for (const e of pack.words ?? []) {
      if (!e || typeof e.w !== 'string' || !e.w.trim() || typeof e.zh !== 'string' || !isLv(e.lv)) continue;
      const id = wordId(e.w, e.pos);
      const lists = [...(pack.lists ?? []), ...(e.lists ?? [])];
      const have = byId.get(id);
      if (have) {
        for (const l of lists) if (!have.lists.includes(l)) have.lists.push(l);
        if (e.heard) have.heard = [...new Set([...(have.heard ?? []), ...e.heard])];
        have.topic ??= e.topic;
        have.cefr ??= e.cefr;
        have.icon ??= e.icon;
        if (!e.retired) have.retired = undefined; // any pack that still offers the word keeps it alive
      } else {
        byId.set(id, {
          id, w: e.w.trim(), pos: e.pos, zh: e.zh, lv: e.lv, icon: e.icon, heard: e.heard, topic: e.topic, cefr: e.cefr,
          lists: [...new Set(lists)],
          ...(e.retired ? { retired: true as const } : {}),
          ...(e.retired && e.replacedBy ? { replacedBy: e.replacedBy } : {}),
        });
      }
    }
  }
  return [...byId.values()];
}

const files = import.meta.glob<Pack>('./packs/*.json', { eager: true, import: 'default' });
/** Packs sorted by id so the order never depends on the bundler. */
export const PACKS: Pack[] = Object.values(files).sort((a, b) => a.id.localeCompare(b.id));

/** Every word ever shipped, retired ones included. */
export const ALL_WORDS: Word[] = buildBank(PACKS);
/** The words the game deals: retired ones are left out. */
export const WORDS: Word[] = ALL_WORDS.filter((w) => !w.retired);
/** Lookup by id covers retired words too, so an old save entry can still be shown. */
export const WORD_BY_ID = new Map(ALL_WORDS.map((w) => [w.id, w]));

export function wordsOfLevel(lv: number): Word[] {
  return WORDS.filter((w) => w.lv === lv);
}

export function wordsInList(listId: string): Word[] {
  return WORDS.filter((w) => w.lists.includes(listId));
}

/** What the old `<level>-<word>` ids (saves up to v2) turn into. */
export function legacyIdMap(): Map<string, string> {
  return new Map(WORDS.map((w) => [`${w.lv}-${w.w}`, w.id]));
}

export interface Topic {
  id: string;
  zh: string;
  icon: string;
  about: string;
}

export const TOPICS: readonly Topic[] = topicData.topics;
export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
