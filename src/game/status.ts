import type { Rng } from '../util/rng';

/**
 * Status conditions a spell may leave on the wild creature. Each type has one.
 * A creature that can't act skips its counter-attack, which also keeps fights short.
 */
export type StatusId = 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze' | 'confusion' | 'stun';

export interface StatusInfo {
  id: StatusId;
  zh: string;
  icon: string;
  color: string;
  /** rounds it lasts */
  turns: number;
  /** damage at the end of each round, as a share of max HP */
  dot?: number;
  /** chance it cannot act when it would counter-attack (1 = never acts) */
  skip?: number;
  /** chance it hurts itself instead of attacking */
  selfHit?: number;
}

export const STATUS: Record<StatusId, StatusInfo> = {
  burn: { id: 'burn', zh: '灼傷', icon: '🔥', color: '#e8561e', turns: 3, dot: 0.07 },
  poison: { id: 'poison', zh: '中毒', icon: '☠️', color: '#9b4fc9', turns: 4, dot: 0.05 },
  paralysis: { id: 'paralysis', zh: '麻痺', icon: '⚡', color: '#d9a400', turns: 3, skip: 0.6 },
  sleep: { id: 'sleep', zh: '睡眠', icon: '💤', color: '#6b7bd6', turns: 2, skip: 1 },
  freeze: { id: 'freeze', zh: '冰凍', icon: '❄️', color: '#37b6d6', turns: 2, skip: 1 },
  confusion: { id: 'confusion', zh: '混亂', icon: '💫', color: '#d6559b', turns: 2, selfHit: 0.6 },
  stun: { id: 'stun', zh: '暈眩', icon: '💥', color: '#8a7f6d', turns: 1, skip: 1 },
};

/** A stable order for the conditions (the sound of each is picked by its place here). */
export const STATUS_ORDER = Object.keys(STATUS) as StatusId[];

/** Which condition each type tends to cause. */
export const TYPE_STATUS: Record<string, StatusId> = {
  fire: 'burn', poison: 'poison', bug: 'poison', electric: 'paralysis', steel: 'paralysis',
  grass: 'sleep', ghost: 'sleep', dark: 'sleep', ice: 'freeze', water: 'freeze',
  psychic: 'confusion', fairy: 'confusion', flying: 'confusion',
  normal: 'stun', fighting: 'stun', ground: 'stun', rock: 'stun', dragon: 'stun',
};

/** Chance that a landed spell leaves its condition: better casts help. `resist` < 1 for bosses. */
export function statusChance(tier: 'good' | 'perfect', resist = 1): number {
  return (tier === 'perfect' ? 0.45 : 0.3) * resist;
}

export function rollStatus(type: string, tier: 'good' | 'perfect', rng: Rng, resist = 1): StatusId | null {
  const id = TYPE_STATUS[type];
  return id && rng.next() < statusChance(tier, resist) ? id : null;
}

export type CounterDecision = 'act' | 'skip' | 'selfhit';

/** What is wrong with the wild creature right now (one condition at a time). */
export class Afflictions {
  current: { id: StatusId; left: number } | null = null;

  /** Returns false when it already has a condition. */
  apply(id: StatusId): boolean {
    if (this.current) return false;
    this.current = { id, left: STATUS[id].turns };
    return true;
  }

  get info(): StatusInfo | null {
    return this.current ? STATUS[this.current.id] : null;
  }

  /** When the creature would counter-attack: does it? */
  beforeCounter(rng: Rng): CounterDecision {
    const s = this.info;
    if (!s) return 'act';
    if (s.skip !== undefined && rng.next() < s.skip) return 'skip';
    if (s.selfHit !== undefined && rng.next() < s.selfHit) return 'selfhit';
    return 'act';
  }

  /** End of a round: damage over time, then the condition wears down. */
  endRound(maxHp: number): { dot: number; cured: StatusInfo | null } {
    const s = this.info;
    if (!s || !this.current) return { dot: 0, cured: null };
    const dot = s.dot ? Math.max(2, Math.round(maxHp * s.dot)) : 0;
    this.current.left -= 1;
    if (this.current.left <= 0) {
      this.current = null;
      return { dot, cured: s };
    }
    return { dot, cured: null };
  }

  clear(): void {
    this.current = null;
  }
}
