import { Level } from '../data/levels';
import { createInitialState, gameReducer } from './gameReducer';

const levels: Level[] = [
  {
    id: 1,
    name: 'First',
    type: 'boss',
    description: '',
    imageEmoji: '',
    requiredWords: 1,
    enemyLives: 4,
  },
  {
    id: 2,
    name: 'Second',
    type: 'puzzle',
    description: '',
    imageEmoji: '',
    requiredWords: 2,
    tools: ['key', 'hammer'],
  },
];

describe('gameReducer', () => {
  it('creates a menu state with provided levels and recognition language', () => {
    const state = createInitialState({ levels, recognitionLang: 'en-GB' });

    expect(state.gameState).toBe('menu');
    expect(state.levels).toBe(levels);
    expect(state.recognitionLang).toBe('en-GB');
  });

  it('starts a new game from the first level and resets run progress', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      currentLevel: 1,
      score: 120,
      enemyLives: 1,
      collectedTools: ['key'],
      correctAnswers: 5,
      combo: 3,
      message: 'old message',
    };

    expect(gameReducer(state, { type: 'START_GAME' })).toMatchObject({
      gameState: 'playing',
      currentLevel: 0,
      score: 0,
      enemyLives: 4,
      collectedTools: [],
      correctAnswers: 0,
      combo: 0,
      message: '',
    });
  });

  it('applies boss answer rewards to score, combo, lives, and feedback state', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      gameState: 'playing' as const,
      enemyLives: 4,
      score: 10,
      combo: 1,
      correctAnswers: 2,
    };

    expect(
      gameReducer(state, {
        type: 'HANDLE_CORRECT_ANSWER',
        payload: { points: 40, damage: 2, word: 'shield' },
      }),
    ).toMatchObject({
      score: 50,
      combo: 2,
      enemyLives: 2,
      showEffect: true,
      isBossShaking: true,
      correctAnswers: 3,
      message: '太棒了! 對怪物造成 2 點傷害!',
    });
  });

  it('moves to victory when advancing beyond the final level', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      currentLevel: 1,
    };

    expect(gameReducer(state, { type: 'NEXT_LEVEL' })).toMatchObject({
      gameState: 'victory',
    });
  });
});
