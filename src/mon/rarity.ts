/**
 * How special a creature is, as far as the fight is concerned. 1–3★ are ordinary wild creatures,
 * 4★ are rare and 5★ are legendary: they arrive with a flourish, look different, hit harder on screen
 * and always carry a shield, wherever they are met (a cave, a road, a gym).
 */
export type Grade = 'common' | 'rare' | 'legend';

export function gradeOf(rarity: number): Grade {
  return rarity >= 5 ? 'legend' : rarity >= 4 ? 'rare' : 'common';
}

/**
 * Shield layers for a fight. A gym leader / champion always has a shield (2 layers, 3 from 4★).
 * Everything else only when rare: 4★ two layers, 5★ three. Ordinary wild creatures have none.
 */
export function shieldLayersFor(rarity: number, boss: boolean): number {
  if (boss) return rarity >= 4 ? 3 : 2;
  const g = gradeOf(rarity);
  return g === 'legend' ? 3 : g === 'rare' ? 2 : 0;
}

/** Hearts the party shares in a fight. */
export function heartsFor(rarity: number, boss: boolean): number {
  return boss ? 7 : gradeOf(rarity) === 'common' ? 5 : 6;
}

/** The line shown when it appears. */
export const ENTRANCE: Record<Exclude<Grade, 'common'>, string> = { rare: '稀有怪物！', legend: '傳說登場！' };
