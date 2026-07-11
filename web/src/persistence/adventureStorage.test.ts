import { createAdventure } from '../game/adventure';
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

  it.each([
    ['wrong version', (state: ReturnType<typeof createAdventure>) => ({ ...state, version: 1 })],
    ['out-of-range event index', (state: ReturnType<typeof createAdventure>) => ({
      ...state,
      eventIndex: state.events.length,
    })],
    ['negative Boss turn', (state: ReturnType<typeof createAdventure>) => ({ ...state, bossTurn: -1 })],
    ['non-boolean spell readiness', (state: ReturnType<typeof createAdventure>) => ({ ...state, spellReady: 'yes' })],
    ['invalid completed event ids', (state: ReturnType<typeof createAdventure>) => ({ ...state, completedEventIds: [1] })],
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
