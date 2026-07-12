import type { VocabItem } from '../types/vocab';
import type { LearningProgressState } from '../learning/progress';
import {
  advanceEvent,
  castSpell,
  completeChallenge,
  createAdventure,
  getCurrentEvent,
  getCurrentWordId,
  getMissionWordIds,
  recordMissionProfile,
  repairAdventureWords,
} from './adventure';

const makeWord = (word: string, overrides: Partial<VocabItem> = {}): VocabItem => ({
  id: word,
  word,
  imageName: word,
  difficulty: 1,
  enabled: true,
  size: 0,
  type: '',
  ...overrides,
});

const words = ['apple', 'ball', 'cat', 'dog', 'fish', 'heart', 'lion'].map((word) => makeWord(word));
const options = { seed: 42, vocab: words, progress: {}, now: 1_700_000_000_000 };

function reachBoss() {
  let state = createAdventure(options);
  for (let index = 0; index < 3; index += 1) {
    state = completeChallenge(state);
    state = advanceEvent(state);
  }
  return state;
}

describe('family relay adventure', () => {
  it('creates an equal mission from an equal seed', () => {
    expect(createAdventure(options)).toEqual(createAdventure(options));
    expect(createAdventure(options).events.map((event) => event.kind))
      .toEqual(['escort', 'build', 'scout', 'boss']);
  });

  it('creates equal plans when eligible vocabulary arrives in a different order', () => {
    const vocab = ['zebra', 'äther', 'apple', 'ball', 'cat', 'dog', 'fish'].map((word) => makeWord(word));
    const localeCompare = jest.spyOn(String.prototype, 'localeCompare').mockImplementation(() => 0);

    try {
      const first = createAdventure({ seed: 42, vocab, progress: {}, now: options.now });
      const second = createAdventure({ seed: 42, vocab: [...vocab].reverse(), progress: {}, now: options.now });

      expect(first).toEqual(second);
    } finally {
      localeCompare.mockRestore();
    }
  });

  it('finishes three shared events and all Boss turns', () => {
    let state = createAdventure(options);

    for (let index = 0; index < 3; index += 1) {
      const current = getCurrentEvent(state);
      expect(current?.kind).not.toBe('boss');

      state = completeChallenge(state);
      expect(state.eventIndex).toBe(index);
      expect(state.completedEventIds).toContain(current?.id);
      state = advanceEvent(state);
    }

    expect(getCurrentEvent(state)?.kind).toBe('boss');
    for (const spell of ['fire', 'shield', 'heal'] as const) {
      state = completeChallenge(state);
      state = castSpell(state, spell).state;
    }

    expect(state.rescued).toBe(true);
  });

  it('keeps a charged Boss spell and turn on a wrong spell', () => {
    const charged = completeChallenge(reachBoss());
    const result = castSpell(charged, 'heal');

    expect(result.correct).toBe(false);
    expect(result.state).toEqual(charged);
    expect(result.state.spellReady).toBe(true);
    expect(result.state.bossTurn).toBe(0);
  });

  it('uses enabled review words first and avoids recent ids when alternatives exist', () => {
    const vocab = [
      makeWord('review'),
      makeWord('fresh-1'),
      makeWord('fresh-2'),
      makeWord('fresh-3'),
      makeWord('fresh-4'),
      makeWord('fresh-5'),
      makeWord('fresh-6'),
      makeWord('recent'),
      makeWord('disabled', { enabled: false }),
    ];
    const progress: LearningProgressState = {
      review: {
        wordId: 'review', word: 'review', attempts: 1, correct: 0, misses: 1, streak: 0,
        mastery: 0, lastPracticedAt: 1, lastMissedAt: 1, lastMode: 'spelling', dueAt: 0,
      },
    };

    const state = createAdventure({ seed: 7, vocab, progress, now: 10, recentWordIds: ['recent'] });
    const wordIds = getMissionWordIds(state);

    expect(wordIds[0]).toBe('review');
    expect(wordIds).not.toContain('recent');
    expect(wordIds).not.toContain('disabled');
  });

  it('repairs only invalid word ids without changing event order', () => {
    const state = createAdventure(options);
    const invalid = {
      ...state,
      events: state.events.map((event, index) => {
        if (index === 0) return { ...event, wordId: 'missing' };
        if (event.kind !== 'boss') return event;
        return {
          ...event,
          bossTurns: event.bossTurns?.map((turn, turnIndex) => (
            turnIndex === 1 ? { ...turn, wordId: 'missing' } : turn
          )),
        };
      }),
    };

    const repaired = repairAdventureWords(invalid, words, {}, options.now);

    expect(repairAdventureWords(invalid, words, {}, options.now)).toEqual(repaired);
    expect(repaired.events.map((event) => event.kind)).toEqual(state.events.map((event) => event.kind));
    expect(repaired.events[1].wordId).toBe(state.events[1].wordId);
    expect(getMissionWordIds(repaired)).not.toContain('missing');
  });

  it('replaces a stored word id that is present but disabled', () => {
    const state = createAdventure(options);
    const disabledWordId = state.events[0].wordId!;
    const vocabWithDisabledTarget = words.map((word) => (
      word.id === disabledWordId ? { ...word, enabled: false } : word
    ));

    const repaired = repairAdventureWords(state, vocabWithDisabledTarget, {}, options.now);

    expect(repaired.events.map((event) => event.kind)).toEqual(state.events.map((event) => event.kind));
    expect(repaired.events[0].wordId).not.toBe(disabledWordId);
    expect(getMissionWordIds(repaired)).not.toContain(disabledWordId);
  });

  it('returns the current word and records the active learner profile', () => {
    const state = recordMissionProfile(createAdventure(options), 'kid');

    expect(getCurrentWordId(state)).toBe(getCurrentEvent(state)?.wordId);
    expect(state.modesUsed).toEqual(['kid']);
  });
});
