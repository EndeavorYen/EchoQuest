import type { LearningProgressState } from '../learning/progress';
import {
  STORAGE_KEY_PROGRESS,
  loadProgressFromStorage,
  saveProgressToStorage,
} from './progressStorage';
import { STORAGE_KEY_VOCAB } from './vocabStorage';

describe('progressStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty progress when storage is missing', () => {
    expect(loadProgressFromStorage()).toEqual({});
  });

  it('returns empty progress when stored JSON is invalid', () => {
    localStorage.setItem(STORAGE_KEY_PROGRESS, '{bad-json');

    expect(loadProgressFromStorage()).toEqual({});
  });

  it('returns empty progress when stored progress has an unexpected shape', () => {
    localStorage.setItem(STORAGE_KEY_PROGRESS, '[]');

    expect(loadProgressFromStorage()).toEqual({});

    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify({
      apple: {
        word: 'apple',
      },
    }));

    expect(loadProgressFromStorage()).toEqual({});
  });

  it('saves and loads progress from its own storage key', () => {
    const progress: LearningProgressState = {
      apple: {
        wordId: 'apple',
        word: 'apple',
        attempts: 1,
        correct: 1,
        misses: 0,
        streak: 1,
        mastery: 1,
        lastPracticedAt: 1_700_000_000_000,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: 1_700_086_400_000,
      },
    };

    saveProgressToStorage(progress);

    expect(localStorage.getItem(STORAGE_KEY_PROGRESS)).toBe(JSON.stringify(progress));
    expect(loadProgressFromStorage()).toEqual(progress);
  });

  it('does not overwrite vocabulary storage when saving progress', () => {
    localStorage.setItem(STORAGE_KEY_VOCAB, '[{"word":"apple"}]');

    saveProgressToStorage({});

    expect(localStorage.getItem(STORAGE_KEY_VOCAB)).toBe('[{"word":"apple"}]');
  });
});
