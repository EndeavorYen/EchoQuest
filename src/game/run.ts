import type { Theme } from '../gfx/backdrop';

export type NodeType = 'monster' | 'chest' | 'boss';

export interface MapNode {
  type: NodeType;
  theme: Theme;
}

/** One trek through the map: a short walk of six stops ending with a boss. */
export interface Run {
  seed: number;
  nodes: MapNode[];
  /** index of the next node to play (== number cleared) */
  idx: number;
}

const LAYOUT: Array<[NodeType, Theme]> = [
  ['monster', 'meadow'],
  ['monster', 'meadow'],
  ['chest', 'meadow'],
  ['monster', 'night'],
  ['monster', 'cave'],
  ['boss', 'sunset'],
];

export function newRun(seed: number): Run {
  return {
    seed,
    idx: 0,
    nodes: LAYOUT.map(([type, theme]) => ({ type, theme })),
  };
}

export function currentNode(run: Run): MapNode | null {
  return run.nodes[run.idx] ?? null;
}

export function isFinished(run: Run): boolean {
  return run.idx >= run.nodes.length;
}

export function advance(run: Run): Run {
  return { ...run, idx: Math.min(run.nodes.length, run.idx + 1) };
}

export interface Relic {
  id: string;
  icon: string;
  name: string;
  zh: string;
}

export const RELICS: Relic[] = [
  { id: 'key', icon: '🗝️', name: 'Old Key', zh: '古老鑰匙' },
  { id: 'crown', icon: '👑', name: 'Gold Crown', zh: '黃金皇冠' },
  { id: 'gem', icon: '💎', name: 'Blue Gem', zh: '藍寶石' },
  { id: 'trophy', icon: '🏆', name: 'Trophy', zh: '獎盃' },
  { id: 'coin', icon: '🪙', name: 'Lucky Coin', zh: '幸運硬幣' },
  { id: 'scroll', icon: '📜', name: 'Magic Scroll', zh: '魔法卷軸' },
  { id: 'compass', icon: '🧭', name: 'Compass', zh: '指南針' },
  { id: 'orb', icon: '🔮', name: 'Crystal Ball', zh: '水晶球' },
  { id: 'potion', icon: '⚗️', name: 'Potion', zh: '魔藥' },
  { id: 'shield', icon: '🛡️', name: 'Round Shield', zh: '圓盾' },
  { id: 'sword', icon: '⚔️', name: 'Hero Sword', zh: '英雄之劍' },
  { id: 'vase', icon: '🏺', name: 'Ancient Vase', zh: '古老花瓶' },
];

/** Next relic the party does not own yet (falls back to a repeat once they have them all). */
export function nextRelic(owned: string[], seed: number): Relic {
  const missing = RELICS.filter((r) => !owned.includes(r.id));
  const pool = missing.length ? missing : RELICS;
  return pool[Math.abs(seed) % pool.length];
}
