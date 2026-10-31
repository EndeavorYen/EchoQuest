import type { Progress } from './progress';

export type Level = 1 | 2 | 3 | 4;

export interface Player {
  id: string;
  name: string;
  level: Level;
  /** avatar look index */
  face: number;
  /** the Pokémon that fights for this player (id); starter by seat when unset */
  mon?: number;
  /** a grown-up: boss shields bounce their spells while any layer is up */
  adult?: boolean;
  progress: Progress;
  stats: { dealt: number; perfect: number; blocks: number; words: number };
}

export const PLAYER_NAMES = [
  '小勇者', '小星星', '小火花', '小水滴', '小葉子', '小雷電', '小月亮', '小太陽', '小彩虹', '小雪花', '小石頭', '小雲朵',
  '小糖果', '小泡泡', '小蘋果', '小企鵝',
];

export const MAX_PLAYERS = 4;

let counter = 0;

export function newPlayer(index: number, level: Level = 1): Player {
  counter += 1;
  return {
    id: `p${Date.now().toString(36)}${counter}`,
    name: PLAYER_NAMES[index % PLAYER_NAMES.length],
    level,
    face: index % 6,
    progress: {},
    stats: { dealt: 0, perfect: 0, blocks: 0, words: 0 },
  };
}

/** Damage a perfect hit of a word of this level does. */
export const BASE_DAMAGE: Record<Level, number> = { 1: 12, 2: 20, 3: 32, 4: 48 };

export const TIER_MULT = { perfect: 1, good: 0.6, miss: 0 } as const;

export function comboMult(combo: number): number {
  return 1 + 0.15 * Math.min(combo, 6);
}
