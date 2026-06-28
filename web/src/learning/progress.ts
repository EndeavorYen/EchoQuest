import type { VocabItem } from '../types/vocab';

export type PracticeMode = 'voice' | 'spelling' | 'image_choice';
export type MasteryLevel = 0 | 1 | 2 | 3;

export type WordProgress = {
  wordId: string;
  word: string;
  attempts: number;
  correct: number;
  misses: number;
  streak: number;
  mastery: MasteryLevel;
  lastPracticedAt: number | null;
  lastMissedAt: number | null;
  lastMode: PracticeMode | null;
  dueAt: number;
};

export type LearningProgressState = Record<string, WordProgress>;

export type PracticeAttempt = {
  isCorrect: boolean;
  mode: PracticeMode;
  now: number;
};

export type AnswerFeedback = {
  word: string;
  submitted: string;
  isCorrect: boolean;
  mode: PracticeMode;
  mastery: MasteryLevel;
  nextReviewLabel: string;
};

export type LearningSummary = {
  practicedWords: number;
  masteredWords: number;
  dueWords: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const REVIEW_DELAYS_BY_MASTERY: Record<MasteryLevel, number> = {
  0: HOUR_MS,
  1: DAY_MS,
  2: 3 * DAY_MS,
  3: 7 * DAY_MS,
};

function createEmptyWordProgress(word: VocabItem): WordProgress {
  return {
    wordId: word.id,
    word: word.word,
    attempts: 0,
    correct: 0,
    misses: 0,
    streak: 0,
    mastery: 0,
    lastPracticedAt: null,
    lastMissedAt: null,
    lastMode: null,
    dueAt: 0,
  };
}

function masteryFromStreak(streak: number): MasteryLevel {
  return Math.min(3, Math.max(0, streak)) as MasteryLevel;
}

function getNextDueAt(mastery: MasteryLevel, now: number): number {
  return now + REVIEW_DELAYS_BY_MASTERY[mastery];
}

export function recordPracticeAttempt(
  progress: LearningProgressState,
  word: VocabItem,
  attempt: PracticeAttempt,
): LearningProgressState {
  const previous = progress[word.id] ?? createEmptyWordProgress(word);
  const streak = attempt.isCorrect ? previous.streak + 1 : 0;
  const mastery = attempt.isCorrect ? masteryFromStreak(streak) : 0;

  const nextProgress: WordProgress = {
    ...previous,
    wordId: word.id,
    word: word.word,
    attempts: previous.attempts + 1,
    correct: previous.correct + (attempt.isCorrect ? 1 : 0),
    misses: previous.misses + (attempt.isCorrect ? 0 : 1),
    streak,
    mastery,
    lastPracticedAt: attempt.now,
    lastMissedAt: attempt.isCorrect ? previous.lastMissedAt : attempt.now,
    lastMode: attempt.mode,
    dueAt: attempt.isCorrect ? getNextDueAt(mastery, attempt.now) : attempt.now,
  };

  return {
    ...progress,
    [word.id]: nextProgress,
  };
}

type ReviewRank = {
  due: number;
  mastery: number;
  misses: number;
  practiced: number;
};

function getReviewRank(word: VocabItem, progress: LearningProgressState, now: number): ReviewRank {
  const wordProgress = progress[word.id];

  if (!wordProgress) {
    return {
      due: 1,
      mastery: 0,
      misses: 0,
      practiced: 0,
    };
  }

  return {
    due: wordProgress.dueAt <= now ? 0 : 1,
    mastery: wordProgress.mastery,
    misses: -wordProgress.misses,
    practiced: 1,
  };
}

export function rankWordsForReview(
  words: VocabItem[],
  progress: LearningProgressState,
  now: number,
): VocabItem[] {
  return [...words].sort((left, right) => {
    const leftRank = getReviewRank(left, progress, now);
    const rightRank = getReviewRank(right, progress, now);

    return leftRank.due - rightRank.due
      || leftRank.mastery - rightRank.mastery
      || leftRank.misses - rightRank.misses
      || leftRank.practiced - rightRank.practiced;
  });
}

function isSameReviewRank(left: ReviewRank, right: ReviewRank): boolean {
  return left.due === right.due
    && left.mastery === right.mastery
    && left.misses === right.misses
    && left.practiced === right.practiced;
}

export function getTopReviewCandidates(
  words: VocabItem[],
  progress: LearningProgressState,
  now: number,
): VocabItem[] {
  const rankedWords = rankWordsForReview(words, progress, now);
  const topWord = rankedWords[0];
  if (!topWord) {
    return [];
  }

  const topRank = getReviewRank(topWord, progress, now);
  return rankedWords.filter((word) => isSameReviewRank(getReviewRank(word, progress, now), topRank));
}

export function buildLearningSummary(progress: LearningProgressState, now: number): LearningSummary {
  const items = Object.values(progress).filter((item) => item.attempts > 0);

  return {
    practicedWords: items.length,
    masteredWords: items.filter((item) => item.mastery >= 3).length,
    dueWords: items.filter((item) => item.dueAt <= now).length,
  };
}

function getNextReviewLabel(dueAt: number, now: number): string {
  if (dueAt <= now) {
    return '現在複習';
  }

  const diff = dueAt - now;
  if (diff <= HOUR_MS) {
    return '約 1 小時後';
  }
  if (diff <= DAY_MS) {
    return '約 1 天後';
  }

  return `約 ${Math.ceil(diff / DAY_MS)} 天後`;
}

export function createAnswerFeedback({
  word,
  submitted,
  isCorrect,
  mode,
  progress,
  now,
}: {
  word: VocabItem;
  submitted: string;
  isCorrect: boolean;
  mode: PracticeMode;
  progress: WordProgress;
  now: number;
}): AnswerFeedback {
  return {
    word: word.word,
    submitted,
    isCorrect,
    mode,
    mastery: progress.mastery,
    nextReviewLabel: getNextReviewLabel(progress.dueAt, now),
  };
}
