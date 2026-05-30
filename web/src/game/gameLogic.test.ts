import type { Level } from '../data/levels';
import type { VocabItem } from '../types/vocab';
import {
  calculateBossReward,
  getAvailableWords,
  isAnswerCorrect,
  isLevelComplete,
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
  });

  describe('isLevelComplete', () => {
    it('completes a boss level when enemy lives reach zero', () => {
      const bossLevel: Level = {
        id: 1,
        name: 'Boss',
        type: 'boss',
        description: '',
        imageEmoji: '',
        requiredWords: 1,
        enemyLives: 1,
      };

      expect(isLevelComplete(bossLevel, { enemyLives: 0, collectedTools: [] })).toBe(true);
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

      expect(isLevelComplete(puzzleLevel, { enemyLives: 3, collectedTools: ['key', 'hammer'] })).toBe(true);
    });
  });
});
