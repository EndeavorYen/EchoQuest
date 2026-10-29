import { MAX_PLAYERS, newPlayer, type Player } from './model';
import { newRun, type Run } from './run';
import { legacyIdMap } from '../data/bank';
import { LEDGER, BANK_REV } from '../data/ledger';
import { reconcile } from './reconcile';
import { isTownMap, type TownMap } from './townmap';
import type { MonsterSpec } from '../gfx/monster';

export interface Save {
  v: 3;
  players: Player[];
  /** index of the player highlighted in menus */
  active: number;
  run: Run | null;
  /** the town map of the new front end (the classic game keeps using `run`) */
  townmap: TownMap | null;
  /** word ids the party has defeated monsters with */
  collection: string[];
  relics: string[];
  /** monsters the little ones grew into stickers (toddler mode), newest first */
  stickers: MonsterSpec[];
  /** per word: transcripts a grown-up confirmed as "said it right" on this device */
  aliases: Record<string, string[]>;
  /** Pokémon ids the party has defeated (caught) in battle */
  caught: number[];
  /** Pokémon ids the little ones have grown into stickers (toddler mode), newest first */
  pals: number[];
  /** word-bank revision this save has been brought up to (see data/ledger.ts); absent in older saves */
  bankRev?: number;
  treks: number;
  /** the regions the party has finished, newest last (at most 50) */
  journeys: { title: string; size: string; date: string }[];
  sound: boolean;
  music: boolean;
}

/** Saves live under a versioned key. Older keys are only ever read (never deleted), so an update can't lose anyone's progress. */
const KEY = 'echoquest.v3';
const KEY_V2 = 'echoquest.v2';

export function defaultSave(): Save {
  return {
    v: 3,
    players: [newPlayer(0, 1)],
    active: 0,
    run: null,
    townmap: null,
    collection: [],
    relics: [],
    stickers: [],
    aliases: {},
    caught: [],
    pals: [],
    bankRev: BANK_REV,
    treks: 0,
    journeys: [],
    sound: true,
    music: true,
  };
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function store(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

type Raw = Partial<Omit<Save, 'v'>> & { v?: number };

/** v2 → v3: word ids no longer carry the level (`2-rabbit` → `rabbit:n`). Unknown ids are kept untouched. */
export function migrateV2(data: Raw): Raw {
  const ids = legacyIdMap();
  const fix = (id: string): string => ids.get(id) ?? id;
  return {
    ...data,
    v: 3,
    collection: (data.collection ?? []).map(fix),
    players: (data.players ?? []).map((p) => ({
      ...p,
      progress: Object.fromEntries(Object.entries(p.progress ?? {}).map(([id, wp]) => [fix(id), wp])),
    })),
  };
}

function normalise(data: Raw): Save {
  const base = defaultSave();
  const players = data.players ?? [];
  return {
    ...base,
    ...data,
    v: 3,
    players: players.slice(0, MAX_PLAYERS).map((p, i) => ({
      ...newPlayer(i, 1),
      ...p,
      progress: p.progress ?? {},
      stats: Object.assign({ dealt: 0, perfect: 0, blocks: 0, words: 0 }, p.stats),
    })),
    active: Math.min(data.active ?? 0, players.length - 1),
    run: data.run ?? null,
    townmap: isTownMap(data.townmap) ? data.townmap : null,
    collection: data.collection ?? [],
    relics: data.relics ?? [],
    stickers: Array.isArray(data.stickers) ? data.stickers : [],
    aliases: data.aliases && typeof data.aliases === 'object' ? data.aliases : {},
    caught: Array.isArray(data.caught) ? data.caught.filter((n) => Number.isInteger(n)) : [],
    pals: Array.isArray(data.pals) ? data.pals.filter((n) => Number.isInteger(n)) : [],
    journeys: Array.isArray(data.journeys) ? data.journeys.filter((j) => j && typeof j.title === 'string').slice(-50) : [],
    bankRev: Number.isInteger(data.bankRev) ? data.bankRev : 0,
  };
}

function read(s: StorageLike, key: string): Raw | null {
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Raw;
    return Array.isArray(data.players) && data.players.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export function load(s: StorageLike | null = store()): Save {
  if (!s) return defaultSave();
  const v3 = read(s, KEY);
  if (v3 && v3.v === 3) {
    const save = normalise(v3);
    const fixed = reconcile(save, LEDGER, BANK_REV);
    if (fixed !== save) persist(fixed, s);
    return fixed;
  }
  const v2 = read(s, KEY_V2);
  if (v2 && v2.v === 2) {
    const save = reconcile(normalise(migrateV2(v2)), LEDGER, BANK_REV);
    persist(save, s); // the old v2 entry stays as a backup
    return save;
  }
  return defaultSave();
}

export function persist(save: Save, s: StorageLike | null = store()): void {
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage full or blocked — playing on without saving is fine
  }
}

export function startRun(save: Save): Save {
  return { ...save, run: newRun(Math.floor(Math.random() * 2 ** 31)) };
}
