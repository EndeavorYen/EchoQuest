import { EVO, type EvoMap } from './evolve';
import { MON_BY_ID } from './dex';
import type { Rng } from '../util/rng';

/**
 * Raising a partner. Every word the active player gets right gives their partner experience; when
 * the bar is full the partner evolves (or, when it cannot evolve any more, gains a star). Each of
 * those steps is one "rank". Rank does not add damage: it makes harder words turn up more often
 * (never more than one card in three), and a hard word said right lands as a critical hit.
 */
export interface Growth {
  /** experience towards the next rank */
  xp: number;
  /** steps earned so far (evolutions and stars together), 0–MAX_RANK */
  rank: number;
  /** of those, how many were stars (shown as ★ on the partner) */
  stars: number;
}

export type Growths = Record<string, Growth>;

export const MAX_RANK = 3;

/** Experience to reach the next rank, by current rank. */
export const XP_TO_RANK = [30, 50, 70] as const;

export const NONE: Growth = { xp: 0, rank: 0, stars: 0 };

export function growthOf(gs: Growths | undefined, id: number): Growth {
  return gs?.[id] ?? NONE;
}

/** Forms this creature can evolve into (all of them known to the dex). */
export function evolvesTo(id: number, evo: EvoMap = EVO): number[] {
  return (evo[id]?.to ?? []).filter((k) => MON_BY_ID.has(k));
}

/** Experience still needed for the next rank, or null when there is nothing left to earn. */
export function xpNeeded(g: Growth): number | null {
  return g.rank >= MAX_RANK ? null : XP_TO_RANK[g.rank];
}

/** The bar is full: the next win evolves (or stars) this partner. */
export function isReady(g: Growth): boolean {
  const need = xpNeeded(g);
  return need !== null && g.xp >= need;
}

/** Experience for one word said (or picked, or spelled) right. */
export function xpFor(tier: 'perfect' | 'good', hard: boolean): number {
  return (tier === 'perfect' ? 3 : 2) + (hard ? 2 : 0);
}

/** Add experience; the bar stops at full until the step is taken. */
export function addXp(gs: Growths | undefined, id: number, amount: number): Growths {
  const g = growthOf(gs, id);
  const need = xpNeeded(g);
  if (need === null || amount <= 0) return gs ?? {};
  return { ...gs, [id]: { ...g, xp: Math.min(need, g.xp + amount) } };
}

/** How likely a dealt card is a hard one: a third of the way per rank, never more than one in three. */
export function hardChance(rank: number): number {
  return Math.min(1 / 3, Math.max(0, rank) / 9);
}

export interface GrowStep {
  kind: 'evolve' | 'star';
  from: number;
  /** the new form (same as `from` for a star) */
  to: number;
  rank: number;
  stars: number;
}

/**
 * Take the step for a partner whose bar is full: evolve when it can (a random branch when there
 * are several, like Eevee), otherwise gain a star. The experience moves to the new form.
 */
export function takeStep(gs: Growths | undefined, id: number, rng: Rng, evo: EvoMap = EVO): { gs: Growths; step: GrowStep } | null {
  const g = growthOf(gs, id);
  if (!isReady(g)) return null;
  const next = evolvesTo(id, evo);
  const rank = g.rank + 1;
  if (next.length) {
    const to = next[Math.floor(rng.next() * next.length) % next.length];
    const rest = { ...gs };
    delete rest[id];
    // another player may already be raising that form: keep whichever is further along
    const have = rest[to];
    const grown: Growth = have && have.rank >= rank ? have : { xp: 0, rank, stars: g.stars };
    return { gs: { ...rest, [to]: grown }, step: { kind: 'evolve', from: id, to, rank: grown.rank, stars: grown.stars } };
  }
  const stars = g.stars + 1;
  return { gs: { ...gs, [id]: { xp: 0, rank, stars } }, step: { kind: 'star', from: id, to: id, rank, stars } };
}
