import type { LearningProgressState, WordProgress } from '../learning/progress';

export const STORAGE_KEY_PROGRESS = 'echoquest_progress_v1';

const VALID_MASTERY_LEVELS = new Set([0, 1, 2, 3]);
const VALID_PRACTICE_MODES = new Set(['voice', 'spelling', 'image_choice']);

function isNullableNumber(value: unknown): boolean {
  return value === null || typeof value === 'number';
}

function isWordProgress(value: unknown): value is WordProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasValidLastMode = candidate.lastMode === null
    || (typeof candidate.lastMode === 'string' && VALID_PRACTICE_MODES.has(candidate.lastMode));

  return typeof candidate.wordId === 'string'
    && typeof candidate.word === 'string'
    && typeof candidate.attempts === 'number'
    && typeof candidate.correct === 'number'
    && typeof candidate.misses === 'number'
    && typeof candidate.streak === 'number'
    && typeof candidate.mastery === 'number'
    && VALID_MASTERY_LEVELS.has(candidate.mastery)
    && isNullableNumber(candidate.lastPracticedAt)
    && isNullableNumber(candidate.lastMissedAt)
    && hasValidLastMode
    && typeof candidate.dueAt === 'number';
}

export function loadProgressFromStorage(): LearningProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed);
    if (!entries.every(([, value]) => isWordProgress(value))) {
      return {};
    }

    return parsed as LearningProgressState;
  } catch {
    return {};
  }
}

export function saveProgressToStorage(progress: LearningProgressState): void {
  localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
}
