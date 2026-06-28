import { Level } from '../data/levels';
import type { FeedbackEvent } from '../feedback/feedbackEvents';
import type { AnswerFeedback, LearningProgressState } from '../learning/progress';
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
    expect(state.learnerProfile).toBe('kid');
    expect(state.progress).toEqual({});
    expect(state.lastAnswerFeedback).toBeNull();
    expect(state.feedbackEvent).toBeNull();
    expect(state).not.toHaveProperty('showEffect');
    expect(state).not.toHaveProperty('isBossShaking');
  });

  it('starts a new game from the first level and resets run progress', () => {
    const progress: LearningProgressState = {
      apple: {
        wordId: 'apple',
        word: 'apple',
        attempts: 1,
        correct: 1,
        misses: 0,
        streak: 1,
        mastery: 1,
        lastPracticedAt: 1,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: 2,
      },
    };
    const feedback: AnswerFeedback = {
      word: 'apple',
      submitted: 'apple',
      isCorrect: true,
      mode: 'spelling',
      mastery: 1,
      nextReviewLabel: '約 1 天後',
    };
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      progress,
      lastAnswerFeedback: feedback,
      feedbackEvent: {
        id: 'incorrect-1',
        kind: 'incorrect',
        tone: 'caution',
        message: 'Try again',
        createdAt: 1,
      } as FeedbackEvent,
      currentLevel: 1,
      score: 120,
      enemyLives: 1,
      collectedTools: ['key'],
      correctAnswers: 5,
      levelCorrectAnswers: 2,
      skippedWords: 1,
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
      levelCorrectAnswers: 0,
      skippedWords: 0,
      combo: 0,
      message: '',
      progress,
      lastAnswerFeedback: null,
      feedbackEvent: null,
    });
  });

  it('stores loaded learning progress', () => {
    const progress: LearningProgressState = {
      apple: {
        wordId: 'apple',
        word: 'apple',
        attempts: 1,
        correct: 0,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: 1,
        lastMissedAt: 1,
        lastMode: 'voice',
        dueAt: 1,
      },
    };

    expect(gameReducer(createInitialState({ levels }), { type: 'SET_PROGRESS', payload: progress }).progress).toBe(progress);
  });

  it('stores the selected learner profile', () => {
    const state = gameReducer(createInitialState({ levels }), {
      type: 'SET_LEARNER_PROFILE',
      payload: 'toddler',
    });

    expect(state.learnerProfile).toBe('toddler');
  });

  it('stores and clears answer feedback', () => {
    const feedback: AnswerFeedback = {
      word: 'apple',
      submitted: 'apl',
      isCorrect: false,
      mode: 'spelling',
      mastery: 0,
      nextReviewLabel: '現在複習',
    };
    const withFeedback = gameReducer(createInitialState({ levels }), {
      type: 'SET_LAST_ANSWER_FEEDBACK',
      payload: feedback,
    });

    expect(withFeedback.lastAnswerFeedback).toBe(feedback);
    expect(gameReducer(withFeedback, { type: 'SET_LAST_ANSWER_FEEDBACK', payload: null }).lastAnswerFeedback).toBeNull();
  });

  it('stores and clears feedback events', () => {
    const feedbackEvent: FeedbackEvent = {
      id: 'correct-1',
      kind: 'correct',
      tone: 'success',
      message: 'Nice hit',
      createdAt: 1,
    };
    const withFeedback = gameReducer(createInitialState({ levels }), {
      type: 'SET_FEEDBACK_EVENT',
      payload: feedbackEvent,
    });

    expect(withFeedback.feedbackEvent).toBe(feedbackEvent);
    expect(gameReducer(withFeedback, { type: 'CLEAR_FEEDBACK_EVENT' }).feedbackEvent).toBeNull();
  });

  it('clears answer feedback when selecting a new word', () => {
    const state = {
      ...createInitialState({ levels }),
      feedbackEvent: {
        id: 'incorrect-1',
        kind: 'incorrect',
        tone: 'caution',
        message: 'Try again',
        createdAt: 1,
      } as FeedbackEvent,
      lastAnswerFeedback: {
        word: 'apple',
        submitted: 'apl',
        isCorrect: false,
        mode: 'spelling',
        mastery: 0,
        nextReviewLabel: '現在複習',
      } as AnswerFeedback,
      userInput: 'apl',
    };

    expect(gameReducer(state, { type: 'SELECT_NEW_WORD', payload: null })).toMatchObject({
      currentWord: null,
      userInput: '',
      lastAnswerFeedback: null,
      feedbackEvent: null,
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
      levelCorrectAnswers: 1,
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
      correctAnswers: 3,
      levelCorrectAnswers: 2,
      message: '太棒了! +40 分，對怪物造成 2 點傷害!',
    });
  });

  it('clears feedback events when resetting effects', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      feedbackEvent: {
        id: 'correct-1',
        kind: 'correct',
        tone: 'success',
        message: 'Nice hit',
        createdAt: 1,
      } as FeedbackEvent,
    };

    expect(gameReducer(state, { type: 'RESET_EFFECTS' }).feedbackEvent).toBeNull();
  });

  it('resets the current level progress when moving to the next level', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      currentLevel: 0,
      levelCorrectAnswers: 1,
      skippedWords: 2,
    };

    expect(gameReducer(state, { type: 'NEXT_LEVEL', payload: { from: 'boss' } })).toMatchObject({
      currentLevel: 1,
      levelCorrectAnswers: 0,
      skippedWords: 0,
      message: '目標完成! 進入下一關!',
    });
  });

  it('makes skipping a meaningful choice by clearing combo, tracking skips, and applying a small score penalty', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      score: 12,
      combo: 3,
      skippedWords: 1,
    };

    expect(gameReducer(state, { type: 'SKIP_WORD' })).toMatchObject({
      score: 7,
      combo: 0,
      skippedWords: 2,
      message: '已跳過這題：扣 5 分並失去連擊。',
    });
  });

  it('does not let skip penalties push score below zero', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      score: 3,
      combo: 1,
    };

    expect(gameReducer(state, { type: 'SKIP_WORD' })).toMatchObject({
      score: 0,
      combo: 0,
    });
  });

  it('explains mistakes without subtracting score', () => {
    const state = {
      ...createInitialState({ levels, recognitionLang: 'en-US' }),
      score: 12,
      combo: 2,
    };

    expect(gameReducer(state, { type: 'HANDLE_INCORRECT_ANSWER' })).toMatchObject({
      score: 12,
      combo: 0,
      message: '再試一次! 連擊歸零，但不扣分。',
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
