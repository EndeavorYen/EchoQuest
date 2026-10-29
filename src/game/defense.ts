import type { Rng } from '../util/rng';

/**
 * A successful shield spell turns into one of four things. How well it was said
 * (perfect or just good) shifts the odds toward the flashier ones.
 *   block   – takes the hit, nothing else
 *   dodge   – steps aside, nothing else
 *   reflect – sends the attack back (x1 damage)
 *   counter – answers with a move of its own (x1.5 damage)
 */
export type DefenseKind = 'block' | 'dodge' | 'reflect' | 'counter';

export const DEFENSE: Record<DefenseKind, { zh: string; mult: number; color: string }> = {
  block: { zh: '擋住！', mult: 0, color: '#2e9e5b' },
  dodge: { zh: '閃躲！', mult: 0, color: '#1b9aaa' },
  reflect: { zh: '反彈！', mult: 1, color: '#3b78c4' },
  counter: { zh: '反擊！', mult: 1.5, color: '#e0701a' },
};

const ODDS: Record<'good' | 'perfect', Array<[DefenseKind, number]>> = {
  good: [['block', 0.45], ['dodge', 0.35], ['reflect', 0.2]],
  perfect: [['block', 0.15], ['dodge', 0.15], ['reflect', 0.4], ['counter', 0.3]],
};

export function rollDefense(tier: 'good' | 'perfect', rng: Rng): DefenseKind {
  let r = rng.next();
  for (const [kind, p] of ODDS[tier]) {
    r -= p;
    if (r < 0) return kind;
  }
  return 'block';
}
