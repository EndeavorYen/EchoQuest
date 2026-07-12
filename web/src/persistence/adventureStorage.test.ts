import {
  advanceEvent,
  castSpell,
  completeChallenge,
  completeRoomChallenge,
  createAdventure,
} from '../game/adventure';
import {
  STORAGE_KEY_ADVENTURE,
  clearAdventureFromStorage,
  loadAdventureFromStorage,
  saveAdventureToStorage,
} from './adventureStorage';

const testMissionOptions = {
  seed: 42,
  vocab: ['apple', 'ball', 'cat', 'dog', 'fish', 'heart'].map((word) => ({
    id: word,
    word,
    imageName: word,
    difficulty: 1,
    enabled: true,
    size: 0,
    type: '',
  })),
  progress: {},
  now: 1_700_000_000_000,
};

function resolveRelayBoss() {
  let state = createAdventure(testMissionOptions);
  for (let index = 0; index < 3; index += 1) {
    state = advanceEvent(completeChallenge(state));
  }

  for (const spell of ['fire', 'shield', 'heal'] as const) {
    state = castSpell(completeChallenge(state), spell).state;
  }

  return state;
}

describe('adventureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for missing, malformed, and invalid storage', () => {
    expect(loadAdventureFromStorage()).toBeNull();

    localStorage.setItem(STORAGE_KEY_ADVENTURE, '{bad-json');
    expect(loadAdventureFromStorage()).toBeNull();

    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify({ version: 2, events: [] }));
    expect(loadAdventureFromStorage()).toBeNull();
  });

  it('round-trips a mission without overwriting vocabulary or progress', () => {
    const state = createAdventure(testMissionOptions);
    localStorage.setItem('echoquest_vocab_v1', '[{"word":"apple"}]');
    localStorage.setItem('echoquest_progress_v1', '{"apple":{"word":"apple"}}');

    saveAdventureToStorage(state);

    expect(loadAdventureFromStorage()).toEqual(state);

    clearAdventureFromStorage();

    expect(localStorage.getItem('echoquest_vocab_v1')).toBe('[{"word":"apple"}]');
    expect(localStorage.getItem('echoquest_progress_v1')).toBe('{"apple":{"word":"apple"}}');
  });

  it('accepts a completed current event and a resolved Boss lifecycle', () => {
    const state = createAdventure(testMissionOptions);
    const completedCurrentEvent = {
      ...state,
      completedEventIds: [state.events[0].id],
    };
    const rescued = resolveRelayBoss();

    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(completedCurrentEvent));
    expect(loadAdventureFromStorage()).toEqual(completedCurrentEvent);

    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(rescued));
    expect(loadAdventureFromStorage()).toEqual(rescued);
  });

  it('round-trips the current legacy room-flow state', () => {
    let state = createAdventure();
    state = completeRoomChallenge(state);
    state = completeRoomChallenge(state);
    state = castSpell(state, 'fire').state;

    saveAdventureToStorage(state);

    expect(loadAdventureFromStorage()).toEqual(state);
  });

  it('rejects stored transient state properties', () => {
    const state = createAdventure(testMissionOptions);

    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify({
      ...state,
      draft: { answer: 'apple' },
    }));

    expect(loadAdventureFromStorage()).toBeNull();
  });

  it('does not persist transient state properties', () => {
    const state = createAdventure(testMissionOptions);
    const stateWithTransients = {
      ...state,
      draft: { answer: 'apple' },
      mic: { listening: true },
      animation: { phase: 'celebrate' },
    };

    saveAdventureToStorage(stateWithTransients);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!)).toEqual(state);
  });

  it.each([
    ['wrong version', (state: ReturnType<typeof createAdventure>) => ({ ...state, version: 1 })],
    ['out-of-range event index', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      eventIndex: state.events.length,
    })],
    ['negative Boss turn', (state: ReturnType<typeof createAdventure>) => ({ ...state, bossTurn: -1 })],
    ['unrescued completed Boss turn', (state: ReturnType<typeof createAdventure>) => ({ ...state, bossTurn: 3 })],
    ['rescued incomplete Boss turn', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      bossTurn: 2,
      rescued: true,
    })],
    ['an active Boss before the Boss event', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      bossTurn: 1,
    })],
    ['a rescued state before the Boss event', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      bossTurn: 3,
      rescued: true,
    })],
    ['non-boolean spell readiness', (state: ReturnType<typeof createAdventure>) => ({ ...state, spellReady: 'yes' })],
    ['invalid completed event ids', (state: ReturnType<typeof createAdventure>) => ({ ...state, completedEventIds: [1] })],
    ['duplicate completed event ids', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      completedEventIds: [state.events[0].id, state.events[0].id],
    })],
    ['a completed Boss event id', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      completedEventIds: [state.events[state.events.length - 1].id],
    })],
    ['a future completed event id', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      completedEventIds: [state.events[1].id],
    })],
    ['a skipped completed event', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      eventIndex: 2,
      completedEventIds: [state.events[0].id],
    })],
    ['non-boolean rescue status', (state: ReturnType<typeof createAdventure>) => ({ ...state, rescued: 'yes' })],
    ['invalid rewards', (state: ReturnType<typeof createAdventure>) => ({ ...state, rewards: [1] })],
    ['invalid learner modes', (state: ReturnType<typeof createAdventure>) => ({ ...state, modesUsed: ['wizard'] })],
    ['missing non-Boss word id', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      events: [{ ...state.events[0], wordId: undefined }, ...state.events.slice(1)],
    })],
    ['invalid Boss turns', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      events: state.events.map((event) => event.kind === 'boss'
        ? { ...event, bossTurns: event.bossTurns?.slice(0, 2) }
        : event),
    })],
  ])('returns null for %s', (_, corrupt) => {
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(corrupt(createAdventure(testMissionOptions))));

    expect(loadAdventureFromStorage()).toBeNull();
  });
});
