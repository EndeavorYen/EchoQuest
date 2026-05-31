import type { VocabItem } from '../types/vocab';
import { defaultLevels, type Level } from '../data/levels';
import type { AnswerFeedback, LearningProgressState } from '../learning/progress';

export type GameState = 'menu' | 'playing' | 'victory' | 'vocab_management';

export interface AppState {
  vocab: VocabItem[];
  levels: Level[];
  currentLevel: number;
  currentWord: VocabItem | null;
  userInput: string;
  score: number;
  enemyLives: number;
  collectedTools: string[];
  message: string;
  practiceMode: 'voice' | 'spelling';
  gameState: GameState;
  correctAnswers: number;
  levelCorrectAnswers: number;
  skippedWords: number;
  showEffect: boolean;
  combo: number;
  showHint: boolean;
  isBossShaking: boolean;
  recognitionLang: string;
  progress: LearningProgressState;
  lastAnswerFeedback: AnswerFeedback | null;
}

export type AppAction =
  | { type: 'SET_VOCAB'; payload: VocabItem[] }
  | { type: 'SET_LEVELS'; payload: Level[] }
  | { type: 'START_GAME' }
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SELECT_NEW_WORD'; payload: VocabItem | null }
  | { type: 'HANDLE_CORRECT_ANSWER'; payload: { points: number; damage: number; word: string } }
  | { type: 'HANDLE_PUZZLE_CORRECT'; payload: { word: string } }
  | { type: 'HANDLE_INCORRECT_ANSWER' }
  | { type: 'NEXT_LEVEL'; payload?: { from: 'puzzle' | 'boss' } }
  | { type: 'SET_USER_INPUT'; payload: string }
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'TOGGLE_PRACTICE_MODE' }
  | { type: 'SET_PRACTICE_MODE'; payload: AppState['practiceMode'] }
  | { type: 'SET_SHOW_HINT'; payload: boolean }
  | { type: 'SET_RECOGNITION_LANG'; payload: string }
  | { type: 'SET_PROGRESS'; payload: LearningProgressState }
  | { type: 'SET_LAST_ANSWER_FEEDBACK'; payload: AnswerFeedback | null }
  | { type: 'SKIP_WORD' }
  | { type: 'SET_COMBO'; payload: number }
  | { type: 'RESET_EFFECTS' };

export const POINTS_PER_PUZZLE = 10;
export const SKIP_PENALTY = 5;

interface InitialStateOptions {
  levels?: Level[];
  recognitionLang?: string;
  progress?: LearningProgressState;
}

export function createInitialState({
  levels = defaultLevels,
  recognitionLang = 'en-US',
  progress = {},
}: InitialStateOptions = {}): AppState {
  return {
    vocab: [],
    levels,
    currentLevel: 0,
    currentWord: null,
    userInput: '',
    score: 0,
    enemyLives: 5,
    collectedTools: [],
    message: '',
    practiceMode: 'voice',
    gameState: 'menu',
    correctAnswers: 0,
    levelCorrectAnswers: 0,
    skippedWords: 0,
    showEffect: false,
    combo: 0,
    showHint: false,
    isBossShaking: false,
    recognitionLang,
    progress,
    lastAnswerFeedback: null,
  };
}

export function gameReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VOCAB':
      return { ...state, vocab: action.payload };
    case 'SET_LEVELS':
      return { ...state, levels: action.payload };
    case 'START_GAME':
      return {
        ...state,
        gameState: 'playing',
        currentLevel: 0,
        score: 0,
        enemyLives: state.levels[0]?.enemyLives || 5,
        collectedTools: [],
        correctAnswers: 0,
        levelCorrectAnswers: 0,
        skippedWords: 0,
        combo: 0,
        message: '',
        lastAnswerFeedback: null,
      };
    case 'SET_GAME_STATE':
      return {
        ...state,
        gameState: action.payload,
        message: action.payload === 'menu' ? '請先到字彙管理新增單字!' : '',
      };
    case 'SELECT_NEW_WORD':
      return { ...state, currentWord: action.payload, userInput: '', lastAnswerFeedback: null };
    case 'HANDLE_CORRECT_ANSWER': {
      const { points, damage } = action.payload;
      const newEnemyLives = state.enemyLives - damage;

      return {
        ...state,
        score: state.score + points,
        combo: state.combo + 1,
        showEffect: true,
        enemyLives: newEnemyLives,
        message: `太棒了! +${points} 分，對怪物造成 ${damage} 點傷害!`,
        isBossShaking: true,
        correctAnswers: state.correctAnswers + 1,
        levelCorrectAnswers: state.levelCorrectAnswers + 1,
      };
    }
    case 'HANDLE_PUZZLE_CORRECT': {
      const newCollectedTools = [...state.collectedTools, action.payload.word];

      return {
        ...state,
        score: state.score + POINTS_PER_PUZZLE,
        combo: state.combo + 1,
        showEffect: true,
        collectedTools: newCollectedTools,
        message: `獲得了 ${action.payload.word}!`,
        correctAnswers: state.correctAnswers + 1,
        levelCorrectAnswers: state.levelCorrectAnswers + 1,
      };
    }
    case 'HANDLE_INCORRECT_ANSWER':
      return { ...state, message: '再試一次! 連擊歸零，但不扣分。', combo: 0 };
    case 'NEXT_LEVEL': {
      const nextLevelIndex = state.currentLevel + 1;

      if (nextLevelIndex >= state.levels.length) {
        return { ...state, gameState: 'victory' };
      }

      const message = action.payload?.from === 'puzzle'
        ? '謎題解開! 進入下一關!'
        : '目標完成! 進入下一關!';

      return {
        ...state,
        currentLevel: nextLevelIndex,
        enemyLives: state.levels[nextLevelIndex]?.enemyLives || 5,
        collectedTools: [],
        levelCorrectAnswers: 0,
        skippedWords: 0,
        message,
      };
    }
    case 'SET_USER_INPUT':
      return { ...state, userInput: action.payload };
    case 'SET_MESSAGE':
      return { ...state, message: action.payload };
    case 'TOGGLE_PRACTICE_MODE':
      return { ...state, practiceMode: state.practiceMode === 'voice' ? 'spelling' : 'voice' };
    case 'SET_PRACTICE_MODE':
      return { ...state, practiceMode: action.payload };
    case 'SET_SHOW_HINT':
      return { ...state, showHint: action.payload };
    case 'SET_RECOGNITION_LANG':
      return { ...state, recognitionLang: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_LAST_ANSWER_FEEDBACK':
      return { ...state, lastAnswerFeedback: action.payload };
    case 'SKIP_WORD':
      return {
        ...state,
        score: Math.max(0, state.score - SKIP_PENALTY),
        combo: 0,
        skippedWords: state.skippedWords + 1,
        message: `已跳過這題：扣 ${SKIP_PENALTY} 分並失去連擊。`,
      };
    case 'SET_COMBO':
      return { ...state, combo: action.payload };
    case 'RESET_EFFECTS':
      return { ...state, showEffect: false, isBossShaking: false };
    default:
      return state;
  }
}
