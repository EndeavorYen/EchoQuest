export type AdventureRoom = 'orchard' | 'bridge' | 'rescue' | 'complete';
export type BossIntent = 'thorns' | 'falling_branch' | 'curse';
export type Spell = 'fire' | 'shield' | 'heal';

export type AdventureState = {
  room: AdventureRoom;
  bossTurn: number;
  rescued: boolean;
  rewards: string[];
};

const bossTurns: Array<{ intent: BossIntent; spell: Spell; hint: string }> = [
  { intent: 'thorns', spell: 'fire', hint: '荊棘怕火焰。' },
  { intent: 'falling_branch', spell: 'shield', hint: '用護盾擋住落下的樹枝。' },
  { intent: 'curse', spell: 'heal', hint: '治療魔法可以解除詛咒。' },
];

export function createAdventure(): AdventureState {
  return { room: 'orchard', bossTurn: 0, rescued: false, rewards: [] };
}

export function completeRoomChallenge(state: AdventureState): AdventureState {
  if (state.room === 'orchard') return { ...state, room: 'bridge', rewards: [...state.rewards, 'healing-apple'] };
  if (state.room === 'bridge') return { ...state, room: 'rescue', rewards: [...state.rewards, 'bridge-star'] };
  return state;
}

export function getBossTurn(state: AdventureState) {
  return bossTurns[Math.min(state.bossTurn, bossTurns.length - 1)];
}

export function castSpell(state: AdventureState, spell: Spell) {
  const turn = getBossTurn(state);
  if (state.room !== 'rescue' || spell !== turn.spell) {
    return { state, correct: false, hint: turn.hint };
  }

  const bossTurn = state.bossTurn + 1;
  return bossTurn === bossTurns.length
    ? { state: { ...state, room: 'complete' as const, bossTurn, rescued: true, rewards: [...state.rewards, 'forest-wizard'] }, correct: true, hint: '' }
    : { state: { ...state, bossTurn }, correct: true, hint: '' };
}
