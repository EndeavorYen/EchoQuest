import { BASE_DAMAGE, TIER_MULT, comboMult, type Player } from './model';
import type { Tier } from '../speech/match';
import type { Word } from '../data/words';
import type { RampName } from '../gfx/palette';
import type { Kind } from '../gfx/monster';

export interface MonsterState {
  name: string;
  hp: number;
  maxHp: number;
  boss: boolean;
}

export interface AttackResult {
  damage: number;
  tier: Tier;
  combo: number;
  killed: boolean;
}

export interface DefenseResult {
  blocked: boolean;
  /** damage reflected at the monster */
  reflect: number;
  combo: number;
  healed: number;
  killed: boolean;
}

const PREFIX: Record<RampName, string> = {
  fire: 'Ember', berry: 'Berry', leaf: 'Mossy', water: 'Splashy', sky: 'Breezy',
  sun: 'Sunny', ghost: 'Boo', night: 'Shadow', plum: 'Plummy',
};
const SUFFIX: Record<Kind, string> = {
  blob: 'Blob', bean: 'Bean', ghost: 'Wisp', drop: 'Drop', rock: 'Pebble',
};
const ATTACK: Record<RampName, string> = {
  fire: 'FLAME PUFF', berry: 'BERRY BOMB', leaf: 'VINE WHIP', water: 'SPLASH', sky: 'GUST',
  sun: 'SUNBEAM', ghost: 'BOO!', night: 'SHADOW WAVE', plum: 'GOO SPLAT',
};

export function monsterName(ramp: RampName, kind: Kind, boss: boolean): string {
  return `${boss ? 'King ' : ''}${PREFIX[ramp]} ${SUFFIX[kind]}`;
}

export function attackName(ramp: RampName): string {
  return ATTACK[ramp];
}

/** How much HP a monster gets: about three good hits from this party. */
export function monsterHp(players: Player[], index: number, boss: boolean): number {
  const avg = players.reduce((a, p) => a + BASE_DAMAGE[p.level], 0) / Math.max(1, players.length);
  const hits = boss ? 9 : 3 + index * 0.25;
  return Math.max(30, Math.round((avg * 1.4 * hits) / 5) * 5);
}

export class Battle {
  monster: MonsterState;
  players: Player[];
  /** index of the player whose turn it is to attack */
  turn = 0;
  combo = 0;
  round = 1;

  constructor(monster: MonsterState, players: Player[], startIndex = 0) {
    this.monster = monster;
    this.players = players;
    this.turn = startIndex % players.length;
  }

  /** Whoever is selected casts the spell… */
  get attacker(): Player {
    return this.players[this.turn];
  }

  /** …and the same selected player holds up the shield (the party calls out "quick, switch to big brother!"). */
  get defender(): Player {
    return this.players[this.turn];
  }

  /** Switch to another player (one tap on their avatar). */
  select(index: number): void {
    this.turn = ((index % this.players.length) + this.players.length) % this.players.length;
  }

  /** Take a bite out of the monster without touching combos (shield breaks in the boss fight). */
  chip(fraction: number): number {
    const dmg = Math.min(this.monster.hp - 1, Math.round(this.monster.maxHp * fraction));
    if (dmg > 0) this.monster.hp -= dmg;
    return Math.max(0, dmg);
  }

  /** The finishing blow. Returns the damage dealt. */
  finisher(): number {
    const dmg = this.monster.hp;
    this.monster.hp = 0;
    this.combo += 1;
    return dmg;
  }

  attack(word: Word, tier: Tier, bonus = 1): AttackResult {
    const lv = word.lv;
    if (tier === 'miss') {
      this.combo = 0;
      return { damage: 0, tier, combo: 0, killed: false };
    }
    this.combo += 1;
    const damage = Math.max(1, Math.round(BASE_DAMAGE[lv] * TIER_MULT[tier] * comboMult(this.combo - 1) * bonus));
    this.monster.hp -= damage;
    if (this.monster.hp <= 0) {
      this.monster.hp = 0;
    }
    return { damage, tier, combo: this.combo, killed: this.monster.hp === 0 };
  }

  /** An attacker gave up or ran out of tries. */
  fizzle(): void {
    this.combo = 0;
  }

  /** `mult` scales the damage thrown back: 0 for a plain block or dodge, 1 for a reflect, 1.5 for a counter. */
  defend(blocked: boolean, mult = 1): DefenseResult {
    if (blocked) {
      this.combo += 1;
      const reflect = mult <= 0 ? 0 : Math.max(1, Math.round(BASE_DAMAGE[this.defender.level] * 0.4 * mult));
      this.monster.hp = Math.max(0, this.monster.hp - reflect);
      return { blocked: true, reflect, combo: this.combo, healed: 0, killed: this.monster.hp === 0 };
    }
    // a hit gets through: combo resets and the monster recovers a little (never a defeat)
    this.combo = 0;
    const healed = Math.min(this.monster.maxHp - this.monster.hp, Math.round(this.monster.maxHp * 0.1));
    this.monster.hp += healed;
    return { blocked: false, reflect: 0, combo: 0, healed, killed: false };
  }

  /** A new exchange starts; the same player stays selected until someone taps another avatar. */
  nextRound(): void {
    this.round += 1;
  }
}
