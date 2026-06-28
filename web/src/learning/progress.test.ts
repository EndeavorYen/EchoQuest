import type { VocabItem } from '../types/vocab';
import {
  buildLearningSummary,
  createAnswerFeedback,
  getTopReviewCandidates,
  rankWordsForReview,
  recordPracticeAttempt,
  type LearningProgressState,
} from './progress';

const word = (id: string, value = id): VocabItem => ({
  id,
  word: value,
  difficulty: 1,
  enabled: true,
  imageName: value,
  size: 0,
  type: '',
});

describe('learning progress', () => {
  it('records a first correct spelling attempt', () => {
    const now = 1_700_000_000_000;

    const progress = recordPracticeAttempt({}, word('apple'), {
      isCorrect: true,
      mode: 'spelling',
      now,
    });

    expect(progress.apple).toMatchObject({
      wordId: 'apple',
      word: 'apple',
      attempts: 1,
      correct: 1,
      misses: 0,
      streak: 1,
      mastery: 1,
      lastPracticedAt: now,
      lastMissedAt: null,
      lastMode: 'spelling',
    });
    expect(progress.apple.dueAt).toBeGreaterThan(now);
  });

  it('records an incorrect voice attempt as due immediately', () => {
    const now = 1_700_000_000_000;

    const progress = recordPracticeAttempt({}, word('apple'), {
      isCorrect: false,
      mode: 'voice',
      now,
    });

    expect(progress.apple).toMatchObject({
      attempts: 1,
      correct: 0,
      misses: 1,
      streak: 0,
      mastery: 0,
      lastPracticedAt: now,
      lastMissedAt: now,
      lastMode: 'voice',
      dueAt: now,
    });
  });

  it('records image choice attempts separately from voice and spelling', () => {
    const now = 1_700_000_000_000;

    const progress = recordPracticeAttempt({}, word('apple'), {
      isCorrect: true,
      mode: 'image_choice',
      now,
    });

    expect(progress.apple.lastMode).toBe('image_choice');
  });

  it('caps mastery at three after consecutive correct attempts', () => {
    const apple = word('apple');
    const first = recordPracticeAttempt({}, apple, { isCorrect: true, mode: 'spelling', now: 1 });
    const second = recordPracticeAttempt(first, apple, { isCorrect: true, mode: 'spelling', now: 2 });
    const third = recordPracticeAttempt(second, apple, { isCorrect: true, mode: 'spelling', now: 3 });
    const fourth = recordPracticeAttempt(third, apple, { isCorrect: true, mode: 'spelling', now: 4 });

    expect(fourth.apple.mastery).toBe(3);
    expect(fourth.apple.streak).toBe(4);
  });

  it('ranks due lower-mastery words ahead of stable words', () => {
    const now = 1_700_000_000_000;
    const words = [word('stable'), word('due'), word('new')];
    const progress: LearningProgressState = {
      stable: {
        wordId: 'stable',
        word: 'stable',
        attempts: 5,
        correct: 5,
        misses: 0,
        streak: 5,
        mastery: 3,
        lastPracticedAt: now - 1_000,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: now + 7 * 24 * 60 * 60 * 1000,
      },
      due: {
        wordId: 'due',
        word: 'due',
        attempts: 2,
        correct: 1,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: now - 1_000,
        lastMissedAt: now - 1_000,
        lastMode: 'voice',
        dueAt: now,
      },
    };

    expect(rankWordsForReview(words, progress, now).map((item) => item.word)).toEqual([
      'due',
      'new',
      'stable',
    ]);
  });

  it('returns only the top review candidates for random selection', () => {
    const now = 1_700_000_000_000;
    const words = [word('stable'), word('due-a'), word('due-b')];
    const progress: LearningProgressState = {
      stable: {
        wordId: 'stable',
        word: 'stable',
        attempts: 3,
        correct: 3,
        misses: 0,
        streak: 3,
        mastery: 3,
        lastPracticedAt: now - 1_000,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: now + 1_000,
      },
      'due-a': {
        wordId: 'due-a',
        word: 'due-a',
        attempts: 1,
        correct: 0,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: now - 1_000,
        lastMissedAt: now - 1_000,
        lastMode: 'voice',
        dueAt: now,
      },
      'due-b': {
        wordId: 'due-b',
        word: 'due-b',
        attempts: 2,
        correct: 1,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: now - 1_000,
        lastMissedAt: now - 1_000,
        lastMode: 'spelling',
        dueAt: now,
      },
    };

    expect(getTopReviewCandidates(words, progress, now).map((item) => item.word)).toEqual([
      'due-a',
      'due-b',
    ]);
  });

  it('builds a learning summary from progress state', () => {
    const now = 1_700_000_000_000;
    const progress: LearningProgressState = {
      apple: {
        wordId: 'apple',
        word: 'apple',
        attempts: 3,
        correct: 3,
        misses: 0,
        streak: 3,
        mastery: 3,
        lastPracticedAt: now - 1,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: now + 1_000,
      },
      sword: {
        wordId: 'sword',
        word: 'sword',
        attempts: 1,
        correct: 0,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: now - 1,
        lastMissedAt: now - 1,
        lastMode: 'voice',
        dueAt: now,
      },
    };

    expect(buildLearningSummary(progress, now)).toEqual({
      practicedWords: 2,
      masteredWords: 1,
      dueWords: 1,
    });
  });

  it('creates actionable answer feedback', () => {
    const now = 1_700_000_000_000;
    const progress = recordPracticeAttempt({}, word('apple'), {
      isCorrect: false,
      mode: 'spelling',
      now,
    });

    expect(
      createAnswerFeedback({
        word: word('apple'),
        submitted: 'apl',
        isCorrect: false,
        mode: 'spelling',
        progress: progress.apple,
        now,
      }),
    ).toEqual({
      word: 'apple',
      submitted: 'apl',
      isCorrect: false,
      mode: 'spelling',
      mastery: 0,
      nextReviewLabel: '現在複習',
    });
  });
});
