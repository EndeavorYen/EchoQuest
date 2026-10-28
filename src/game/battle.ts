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
  /** a boss refused to fall because someone has not taken a turn yet */
  held: boolean;
  /** names of players still needed for the final blow */
  waitingFor: string[];
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
  private acted = new Set<string>();

  constructor(monster: MonsterState, players: Player[], startIndex = 0) {
    this.monster = monster;
    this.players = players;
    this.turn = startIndex % players.length;
  }

  get attacker(): Player {
    return this.players[this.turn];
  }

  /** The player who has to hold up the shield: the next one in line. */
  get defender(): Player {
    return this.players[(this.turn + 1) % this.players.length];
  }

  private unacted(): Player[] {
    return this.players.filter((p) => !this.acted.has(p.id));
  }

  attack(word: Word, tier: Tier): AttackResult {
    const lv = word.lv;
    if (tier === 'miss') {
      this.combo = 0;
      return { damage: 0, tier, combo: 0, killed: false, held: false, waitingFor: [] };
    }
    this.combo += 1;
    this.acted.add(this.attacker.id);
    const damage = Math.max(1, Math.round(BASE_DAMAGE[lv] * TIER_MULT[tier] * comboMult(this.combo - 1)));
    let held = false;
    let waitingFor: string[] = [];
    this.monster.hp -= damage;
    if (this.monster.hp <= 0) {
      const pending = this.unacted();
      if (this.monster.boss && pending.length > 0) {
        // co-op rule: nobody gets to watch from the sofa
        this.monster.hp = 1;
        held = true;
        waitingFor = pending.map((p) => p.name);
      } else {
        this.monster.hp = 0;
      }
    }
    return { damage, tier, combo: this.combo, killed: this.monster.hp === 0, held, waitingFor };
  }

  /** An attacker gave up or ran out of tries. */
  fizzle(): void {
    this.combo = 0;
  }

  defend(blocked: boolean): DefenseResult {
    this.acted.add(this.defender.id);
    if (blocked) {
      this.combo += 1;
      const reflect = Math.max(1, Math.round(BASE_DAMAGE[this.defender.level] * 0.4));
      this.monster.hp = Math.max(this.monster.boss && this.unacted().length ? 1 : 0, this.monster.hp - reflect);
      return { blocked: true, reflect, combo: this.combo, healed: 0, killed: this.monster.hp === 0 };
    }
    // a hit gets through: combo resets and the monster recovers a little (never a defeat)
    this.combo = 0;
    const healed = Math.min(this.monster.maxHp - this.monster.hp, Math.round(this.monster.maxHp * 0.1));
    this.monster.hp += healed;
    return { blocked: false, reflect: 0, combo: 0, healed, killed: false };
  }

  /** Move on to the next attacker. Players who have not acted yet go first. */
  nextTurn(): void {
    const n = this.players.length;
    if (this.monster.boss && this.monster.hp <= 1) {
      for (let i = 1; i <= n; i++) {
        const idx = (this.turn + i) % n;
        if (!this.acted.has(this.players[idx].id)) {
          this.turn = idx;
          this.round += 1;
          return;
        }
      }
    }
    this.turn = (this.turn + 1) % n;
    this.round += 1;
  }
}
