import { BASE_DAMAGE, comboMult, type Player } from '../game/model';

/** Spoken spells it takes to beat a wild creature of each star rating. Short fights, many creatures. */
const HITS: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 };
export const BOSS_HITS = 5;
/** From this round on the creature is "tired" and one more hit ends the fight. */
export const TIRED_ROUND = 5;

/** What one good hit does for this party: used to size HP and to be kind when a fight drags on. */
export function typicalHit(players: Player[]): number {
  const avg = players.reduce((a, p) => a + BASE_DAMAGE[p.level], 0) / Math.max(1, players.length);
  return Math.max(5, Math.round(avg * 0.85));
}

/** HP such that about `n` clean hits (with the combo bonus) finish it; a slip or two adds a round. */
export function foeHp(players: Player[], rarity: number, boss: boolean): number {
  const n = boss ? BOSS_HITS : HITS[rarity] ?? 3;
  const avg = players.reduce((a, p) => a + BASE_DAMAGE[p.level], 0) / Math.max(1, players.length);
  let total = 0;
  for (let i = 0; i < n; i++) total += avg * comboMult(i) * 0.85;
  return Math.max(20, Math.round(total / 5) * 5);
}
