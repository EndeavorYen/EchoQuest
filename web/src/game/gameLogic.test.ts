import type { Level } from '../data/levels';
import type { VocabItem } from '../types/vocab';
import {
  calculateBossReward,
  getAvailableWords,
  isAnswerCorrect,
  isLevelComplete,
  selectWord,
} from './gameLogic';

const vocab = (word: string, overrides: Partial<VocabItem> = {}): VocabItem => ({
  id: word,
  word,
  difficulty: 1,
  enabled: true,
  imageName: word,
  size: 0,
  type: '',
  ...overrides,
});

describe('gameLogic', () => {
  describe('isAnswerCorrect', () => {
    it('accepts case, spacing, and punctuation differences around the target word', () => {
      expect(isAnswerCorrect('  HAM-mer! ', vocab('hammer'))).toBe(true);
    });

    it('rejects answers that normalize to a different word', () => {
      expect(isAnswerCorrect('ham', vocab('hammer'))).toBe(false);
    });
  });

  describe('calculateBossReward', () => {
    it('uses difficulty for damage and combo-scaled score', () => {
      expect(calculateBossReward(vocab('shield', { difficulty: 3 }), 2)).toEqual({
        damage: 3,
        points: 90,
      });
    });
  });

  describe('getAvailableWords', () => {
    const bossLevel: Level = {
      id: 1,
      name: 'Boss',
      type: 'boss',
      description: '',
      imageEmoji: '',
      requiredWords: 2,
      enemyLives: 3,
    };

    const puzzleLevel: Level = {
      id: 2,
      name: 'Puzzle',
      type: 'puzzle',
      description: '',
      imageEmoji: '',
      requiredWords: 2,
      tools: ['key', 'hammer'],
    };

    it('returns enabled words for boss levels', () => {
      const words = [
        vocab('apple'),
        vocab('disabled', { enabled: false }),
        vocab('shield'),
      ];

      expect(getAvailableWords(words, bossLevel, [])).toEqual([
        vocab('apple'),
        vocab('shield'),
      ]);
    });

    it('returns uncollected puzzle tool words only', () => {
      const words = [
        vocab('key'),
        vocab('hammer'),
        vocab('apple'),
        vocab('disabled', { enabled: false }),
      ];

      expect(getAvailableWords(words, puzzleLevel, ['key'])).toEqual([
        vocab('hammer'),
      ]);
    });

    it('applies level difficulty constraints to boss word pools', () => {
      const words = [
        vocab('apple', { difficulty: 1 }),
        vocab('shield', { difficulty: 3 }),
        vocab('castle', { difficulty: 4 }),
      ];

      expect(getAvailableWords(words, { ...bossLevel, minDifficulty: 2, maxDifficulty: 3 }, [])).toEqual([
        vocab('shield', { difficulty: 3 }),
      ]);
    });

    it('falls back to enabled boss words when difficulty constraints would empty the pool', () => {
      const words = [
        vocab('apple', { difficulty: 1 }),
        vocab('disabled', { difficulty: 1, enabled: false }),
      ];

      expect(getAvailableWords(words, { ...bossLevel, minDifficulty: 3, maxDifficulty: 5 }, [])).toEqual([
        vocab('apple', { difficulty: 1 }),
      ]);
    });
  });

  describe('selectWord', () => {
    it('avoids selecting the previous word when another option is available', () => {
      const words = [vocab('apple'), vocab('shield'), vocab('castle')];

      expect(selectWord(words, () => 0, 'apple')?.word).toBe('shield');
    });

    it('allows selecting the previous word when it is the only available option', () => {
      const words = [vocab('apple')];

      expect(selectWord(words, () => 0.75, 'apple')?.word).toBe('apple');
    });
  });

  describe('isLevelComplete', () => {
    it('completes a boss level when the required word goal is reached', () => {
      const bossLevel: Level = {
        id: 1,
        name: 'Boss',
        type: 'boss',
        description: '',
        imageEmoji: '',
        requiredWords: 1,
        enemyLives: 5,
      };

      expect(isLevelComplete(bossLevel, { enemyLives: 5, collectedTools: [], levelCorrectAnswers: 1 })).toBe(true);
    });

    it('keeps a boss level active until either word goal or lives are cleared', () => {
      const bossLevel: Level = {
        id: 1,
        name: 'Boss',
        type: 'boss',
        description: '',
        imageEmoji: '',
        requiredWords: 2,
        enemyLives: 5,
      };

      expect(isLevelComplete(bossLevel, { enemyLives: 4, collectedTools: [], levelCorrectAnswers: 1 })).toBe(false);
    });

    it('completes a puzzle level when all tools are collected', () => {
      const puzzleLevel: Level = {
        id: 2,
        name: 'Puzzle',
        type: 'puzzle',
        description: '',
        imageEmoji: '',
        requiredWords: 2,
        tools: ['key', 'hammer'],
      };

      expect(isLevelComplete(puzzleLevel, { enemyLives: 3, collectedTools: ['key', 'hammer'], levelCorrectAnswers: 2 })).toBe(true);
    });
  });
});
