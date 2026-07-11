import { castSpell, completeRoomChallenge, createAdventure } from './adventure';

describe('forest rescue adventure', () => {
  it('moves orchard to bridge, bridge to rescue, and rescue to victory', () => {
    let state = createAdventure();
    state = completeRoomChallenge(state);
    expect(state.room).toBe('bridge');
    state = completeRoomChallenge(state);
    expect(state.room).toBe('rescue');

    state = castSpell(state, 'fire').state;
    state = castSpell(state, 'shield').state;
    state = castSpell(state, 'heal').state;
    expect(state.room).toBe('complete');
    expect(state.rescued).toBe(true);
  });

  it('keeps the same boss turn and returns a hint for the wrong spell', () => {
    const rescue = { ...createAdventure(), room: 'rescue' as const };
    const result = castSpell(rescue, 'heal');
    expect(result.correct).toBe(false);
    expect(result.state.bossTurn).toBe(0);
    expect(result.hint).toBe('荊棘怕火焰。');
  });
});
