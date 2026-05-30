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
  const enabledVocab = vocab.filter((word) => word.enabled);

  if (level.type === 'puzzle' && level.tools) {
    return enabledVocab.filter((word) => level.tools?.includes(word.word) && !collectedTools.includes(word.word));
  }

  return enabledVocab;
}

export function isLevelComplete(
  level: Level,
  progress: { enemyLives: number; collectedTools: string[] },
): boolean {
  if (level.type === 'boss') {
    return progress.enemyLives <= 0;
  }

  return progress.collectedTools.length >= (level.tools?.length || 0);
}
