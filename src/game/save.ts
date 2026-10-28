import { MAX_PLAYERS, newPlayer, type Player } from './model';
import { newRun, type Run } from './run';
import { legacyIdMap } from '../data/bank';

export interface Save {
  v: 3;
  players: Player[];
  /** index of the player highlighted in menus */
  active: number;
  run: Run | null;
  /** word ids the party has defeated monsters with */
  collection: string[];
  relics: string[];
  treks: number;
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
    collection: [],
    relics: [],
    treks: 0,
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
    collection: data.collection ?? [],
    relics: data.relics ?? [],
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
  if (v3 && v3.v === 3) return normalise(v3);
  const v2 = read(s, KEY_V2);
  if (v2 && v2.v === 2) {
    const save = normalise(migrateV2(v2));
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
