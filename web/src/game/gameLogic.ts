import type { VocabItem } from '../types/vocab';
import type { Level } from '../data/levels';

const BASE_POINTS_PER_WORD = 10;

export function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/[^a-z]/g, '');
}

export function isAnswerCorrect(answer: string, currentWord: VocabItem): boolean {
  return normalizeAnswer(answer) === currentWord.word;
}

export function calculateBossReward(currentWord: VocabItem, combo: number) {
  return {
    damage: currentWord.difficulty,
    points: currentWord.difficulty * BASE_POINTS_PER_WORD * (combo + 1),
  };
}

export function getAvailableWords(
  vocab: VocabItem[],
  level: Level,
  collectedTools: string[],
): VocabItem[] {
  let availableVocab = vocab.filter((word) => word.enabled);

  if (level.type === 'puzzle' && level.tools) {
    availableVocab = availableVocab.filter((word) => level.tools?.includes(word.word) && !collectedTools.includes(word.word));
  }

  const { minDifficulty, maxDifficulty } = level;
  const hasDifficultyConstraint = minDifficulty !== undefined || maxDifficulty !== undefined;

  if (!hasDifficultyConstraint) {
    return availableVocab;
  }

  let difficultyMatchedVocab = availableVocab;

  if (minDifficulty !== undefined) {
    difficultyMatchedVocab = difficultyMatchedVocab.filter((word) => word.difficulty >= minDifficulty);
  }

  if (maxDifficulty !== undefined) {
    difficultyMatchedVocab = difficultyMatchedVocab.filter((word) => word.difficulty <= maxDifficulty);
  }

  return difficultyMatchedVocab.length > 0 ? difficultyMatchedVocab : availableVocab;
}

export function selectWord(
  availableWords: VocabItem[],
  random: () => number,
  previousWordId?: string,
): VocabItem | null {
  if (availableWords.length === 0) {
    return null;
  }

  const candidates = availableWords.length > 1
    ? availableWords.filter((word) => word.id !== previousWordId)
    : availableWords;
  const index = Math.floor(random() * candidates.length);

  return candidates[index] ?? null;
}

export function isLevelComplete(
  level: Level,
  progress: { enemyLives: number; collectedTools: string[]; levelCorrectAnswers: number },
): boolean {
  if (level.type === 'boss') {
    return progress.enemyLives <= 0 || progress.levelCorrectAnswers >= level.requiredWords;
  }

  return progress.collectedTools.length >= (level.tools?.length || 0);
}
