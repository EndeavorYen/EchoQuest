import { MAX_PLAYERS, newPlayer, type Player } from './model';
import { newRun, type Run } from './run';

export interface Save {
  v: 2;
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

const KEY = 'echoquest.v2';

export function defaultSave(): Save {
  return {
    v: 2,
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

export function load(s: StorageLike | null = store()): Save {
  if (!s) return defaultSave();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<Save>;
    if (data.v !== 2 || !Array.isArray(data.players) || data.players.length === 0) return defaultSave();
    const base = defaultSave();
    return {
      ...base,
      ...data,
      players: data.players.slice(0, MAX_PLAYERS).map((p, i) => ({
        ...newPlayer(i, 1),
        ...p,
        progress: p.progress ?? {},
        stats: Object.assign({ dealt: 0, perfect: 0, blocks: 0, words: 0 }, p.stats),
      })),
      active: Math.min(data.active ?? 0, data.players.length - 1),
      run: data.run ?? null,
      collection: data.collection ?? [],
      relics: data.relics ?? [],
    };
  } catch {
    return defaultSave();
  }
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
