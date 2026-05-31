import React, { useEffect, useMemo, useRef, useReducer, useState } from 'react';
import { VocabManager } from './components/VocabManager';
import type { VocabItem } from './types/vocab';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { defaultLevels, type Level } from './data/levels';
import { calculateBossReward, getAvailableWords, isAnswerCorrect, isLevelComplete, selectWord } from './game/gameLogic';
import { createInitialState, gameReducer } from './game/gameReducer';
import { loadLangFromStorage, loadVocabFromStorage, saveLangToStorage, saveVocabToStorage } from './persistence/vocabStorage';
import { GameScreen } from './screens/GameScreen';
import { MenuScreen } from './screens/MenuScreen';
import { VictoryScreen } from './screens/VictoryScreen';


const BLOCKING_SPEECH_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
const ANSWER_EFFECT_RESET_DELAY_MS = 500;
const ANSWER_ADVANCE_DELAY_MS = 1500;

function isBlockingSpeechError(error: string): boolean {
  return BLOCKING_SPEECH_ERRORS.has(error);
}

function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麥克風權限被阻擋，已切換到拼字模式。請允許麥克風後再試。';
    case 'audio-capture':
      return '找不到可用的麥克風，已切換到拼字模式。';
    case 'network':
      return '語音辨識暫時無法連線，請重試語音。';
    case 'no-speech':
      return '沒有聽到聲音，請再說一次。';
    default:
      return `語音辨識暫時無法使用，請重試語音。 (${error})`;
  }
}

interface AppProps {
    initialVocab?: VocabItem[];
    initialLevels?: Level[];
}

type VoiceReviewResult = {
  heardText: string;
  targetWord: string;
  isMatch: boolean;
};

const App: React.FC<AppProps> = ({ initialVocab: initialVocabProp, initialLevels = defaultLevels }) => {
  const [state, dispatch] = useReducer(gameReducer, createInitialState({
    levels: initialLevels,
    recognitionLang: loadLangFromStorage(),
  }));
  const [voiceReview, setVoiceReview] = useState<VoiceReviewResult | null>(null);
  const voiceReviewRef = useRef<VoiceReviewResult | null>(null);
  const voiceSubmissionLockedRef = useRef(false);
  const updateVoiceReview = (nextReview: VoiceReviewResult | null) => {
    voiceReviewRef.current = nextReview;
    setVoiceReview(nextReview);
  };
  const {
    vocab,
    levels,
    currentLevel,
    currentWord,
    userInput,
    score,
    enemyLives,
    collectedTools,
    message,
    practiceMode,
    gameState,
    correctAnswers,
    levelCorrectAnswers,
    skippedWords,
    showEffect,
    combo,
    showHint,
    isBossShaking,
    recognitionLang,
  } = state;

  const acceptSpeechResultsRef = useRef(false);
  acceptSpeechResultsRef.current = gameState === 'playing'
    && practiceMode === 'voice'
    && !voiceReviewRef.current
    && !voiceSubmissionLockedRef.current;
  const speech = useSpeechRecognition({
    autoRestart: gameState === 'playing' && practiceMode === 'voice',
    onResult: (result) => {
      if (!acceptSpeechResultsRef.current || voiceReviewRef.current) {
        return;
      }
      if (!currentWord) {
        return;
      }

      const heardText = result.trim();
      if (!heardText) {
        return;
      }

      updateVoiceReview({
        heardText,
        targetWord: currentWord.word,
        isMatch: isAnswerCorrect(heardText, currentWord),
      });
    },
  });

  // Load vocab on mount or when prop changes
  useEffect(() => {
    if (initialVocabProp) {
        dispatch({ type: 'SET_VOCAB', payload: initialVocabProp });
    } else {
        const storedVocab = loadVocabFromStorage();
        const initialVocab = storedVocab.length > 0 ? storedVocab : defaultInitialVocab;
        dispatch({ type: 'SET_VOCAB', payload: initialVocab });
    }
  }, [initialVocabProp]);

  // Persist vocab changes, but only if not using props
  useEffect(() => {
    if (!initialVocabProp) {
        saveVocabToStorage(vocab);
    }
  }, [vocab, initialVocabProp]);

  const enabledVocab = useMemo(() => vocab.filter((v: VocabItem) => v.enabled), [vocab]);

  const selectNewWord = () => {
    if (enabledVocab.length === 0) {
        dispatch({ type: 'SET_GAME_STATE', payload: 'menu' });
        return;
    }

    const level = levels[currentLevel];
    const availableWords = getAvailableWords(vocab, level, collectedTools);
    
    if (availableWords.length > 0) {
      const randomWord = selectWord(availableWords, Math.random, currentWord?.id);
      dispatch({ type: 'SELECT_NEW_WORD', payload: randomWord });
    } else {
        // No more words for this level
        if (currentLevel < levels.length - 1) {
            dispatch({ type: 'NEXT_LEVEL' });
        } else {
            dispatch({ type: 'SET_GAME_STATE', payload: 'victory' });
        }
    }
  };

  // Effect to select a new word when the game starts or level changes.
  useEffect(() => {
    if (gameState === 'playing') {
      selectNewWord();
    }
  }, [gameState, currentLevel]);

  // Effect to handle the consequences of a correct answer.
  const correctAnswersRef = useRef(correctAnswers);
  useEffect(() => {
    // This effect should only trigger when a correct answer has been submitted.
    if (gameState !== 'playing' || correctAnswers === correctAnswersRef.current) {
        return;
    }
    correctAnswersRef.current = correctAnswers;

    // Reset visual effects after a short delay
    const effectTimer = setTimeout(() => dispatch({ type: 'RESET_EFFECTS' }), ANSWER_EFFECT_RESET_DELAY_MS);

    const level = levels[currentLevel];
    const levelComplete = isLevelComplete(level, { enemyLives, collectedTools, levelCorrectAnswers });

    // After a longer delay, advance the game
    const gameFlowTimer = setTimeout(() => {
        if (levelComplete) {
            if (currentLevel < levels.length - 1) {
                dispatch({ type: 'NEXT_LEVEL', payload: { from: level.type } });
            } else {
                dispatch({ type: 'SET_GAME_STATE', payload: 'victory' });
            }
        } else {
            selectNewWord(); // Not level complete, so just get the next word.
        }
    }, ANSWER_ADVANCE_DELAY_MS);

    return () => {
        clearTimeout(effectTimer);
        clearTimeout(gameFlowTimer);
    };
  }, [correctAnswers, gameState, enemyLives, collectedTools, levelCorrectAnswers, currentLevel, levels]);

  // Persist language selection
  useEffect(() => {
    saveLangToStorage(recognitionLang);
  }, [recognitionLang]);

  // Effect to clear messages after a delay
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_MESSAGE', payload: '' });
      }, 2000); // Message disappears after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [message]);

  const startGame = () => {
    dispatch({ type: 'START_GAME' });
    // The useEffect listening on [gameState, currentLevel] will call selectNewWord.
  };

  const handleSubmit = (submittedText: string) => {
    if (!currentWord) return;
    
    const isCorrect = isAnswerCorrect(submittedText, currentWord);
    
    if (isCorrect) {
      const level = levels[currentLevel];
      
      if (level.type === 'boss') {
        const { damage, points } = calculateBossReward(currentWord, combo);
        dispatch({ type: 'HANDLE_CORRECT_ANSWER', payload: { points, damage, word: currentWord.word } });
      } else if (level.type === 'puzzle') {
        dispatch({ type: 'HANDLE_PUZZLE_CORRECT', payload: { word: currentWord.word } });
      }
    } else {
      dispatch({ type: 'HANDLE_INCORRECT_ANSWER' });
      if ('speechSynthesis' in window && currentWord) {
        const utterance = new SpeechSynthesisUtterance(currentWord.word);
        if (recognitionLang.startsWith('en-')) {
            utterance.lang = recognitionLang;
        } else {
            utterance.lang = 'en-US';
        }
        window.speechSynthesis.speak(utterance);
      }
    }
    
    dispatch({ type: 'SET_USER_INPUT', payload: '' });
  };

  const confirmVoiceReview = () => {
    if (!voiceReview) {
      return;
    }

    const { heardText, isMatch } = voiceReview;
    updateVoiceReview(null);
    voiceSubmissionLockedRef.current = isMatch;
    handleSubmit(heardText);
  };

  const retryVoiceReview = () => {
    voiceSubmissionLockedRef.current = false;
    updateVoiceReview(null);
    speech.resetTranscript();
    speech.clearError();

    if (practiceMode === 'voice' && !speech.listening) {
      speech.start(recognitionLang);
    }
  };

  useEffect(() => {
    if (!voiceSubmissionLockedRef.current) {
      return;
    }

    const unlockTimer = setTimeout(() => {
      voiceSubmissionLockedRef.current = false;
    }, ANSWER_ADVANCE_DELAY_MS);

    return () => clearTimeout(unlockTimer);
  }, [correctAnswers]);

  useEffect(() => {
    if (!speech.isSupported && practiceMode === 'voice') {
      dispatch({ type: 'SET_PRACTICE_MODE', payload: 'spelling' });
    }
  }, [practiceMode, speech.isSupported]);

  useEffect(() => {
    if (speech.error && practiceMode === 'voice' && isBlockingSpeechError(speech.error)) {
      dispatch({ type: 'SET_PRACTICE_MODE', payload: 'spelling' });
    }
  }, [practiceMode, speech.error]);

  useEffect(() => {
    if (practiceMode !== 'voice' && speech.listening) {
      speech.stop();
    }
    if (practiceMode !== 'voice') {
      voiceSubmissionLockedRef.current = false;
      speech.resetTranscript();
      updateVoiceReview(null);
    }
  }, [practiceMode, speech.listening, speech.resetTranscript, speech.stop]);

  useEffect(() => {
    if (gameState !== 'playing' && speech.listening) {
      speech.stop();
    }
  }, [gameState, speech.listening, speech.stop]);

  useEffect(() => {
    if (practiceMode === 'voice' && speech.listening) {
      speech.start(recognitionLang);
    }
  }, [practiceMode, recognitionLang, speech.listening, speech.start]);

  const handleSkip = () => {
    voiceSubmissionLockedRef.current = false;
    updateVoiceReview(null);
    speech.resetTranscript();
    dispatch({ type: 'SKIP_WORD' });
    selectNewWord();
  };

  const handleTogglePracticeMode = () => {
    if (practiceMode === 'voice' || speech.isSupported) {
      if (practiceMode === 'spelling') {
        speech.clearError();
      }
      if (practiceMode === 'voice' && speech.error) {
        speech.clearError();
      }
      updateVoiceReview(null);
      dispatch({ type: 'TOGGLE_PRACTICE_MODE' });
    }
  };

  const handleToggleListening = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      speech.start(recognitionLang);
    }
  };

  switch (gameState) {
    case 'menu':
      return (
        <MenuScreen
          recognitionLang={recognitionLang}
          speechSupported={speech.isSupported}
          message={message}
          onRecognitionLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })}
          onStartGame={startGame}
          onOpenVocabManagement={() => dispatch({ type: 'SET_GAME_STATE', payload: 'vocab_management' })}
        />
      );
    case 'playing':
      return (
        <GameScreen
          level={levels[currentLevel]}
          currentLevel={currentLevel}
          currentWord={currentWord}
          userInput={userInput}
          score={score}
          enemyLives={enemyLives}
          collectedTools={collectedTools}
          message={message}
          practiceMode={practiceMode}
          levelCorrectAnswers={levelCorrectAnswers}
          skippedWords={skippedWords}
          showEffect={showEffect}
          combo={combo}
          showHint={showHint}
          isBossShaking={isBossShaking}
          recognitionLang={recognitionLang}
          speech={speech}
          speechErrorMessage={speech.error ? getSpeechErrorMessage(speech.error) : null}
          canRetrySpeechError={practiceMode === 'voice' && speech.error !== null && !isBlockingSpeechError(speech.error)}
          voiceReview={voiceReview}
          onSubmit={handleSubmit}
          onUserInputChange={(value) => dispatch({ type: 'SET_USER_INPUT', payload: value })}
          onTogglePracticeMode={handleTogglePracticeMode}
          onToggleListening={handleToggleListening}
          onRecognitionLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })}
          onShowHintChange={(show) => dispatch({ type: 'SET_SHOW_HINT', payload: show })}
          onSkip={handleSkip}
          onRetryVoiceReview={retryVoiceReview}
          onConfirmVoiceReview={confirmVoiceReview}
        />
      );
    case 'victory':
      return (
        <VictoryScreen
          score={score}
          correctAnswers={correctAnswers}
          onStartGame={startGame}
        />
      );
    case 'vocab_management':
        return <VocabManager vocab={vocab} onVocabChange={(v) => dispatch({ type: 'SET_VOCAB', payload: v })} onGoBack={() => dispatch({ type: 'SET_GAME_STATE', payload: 'menu' })} />;
    default:
      return (
        <MenuScreen
          recognitionLang={recognitionLang}
          speechSupported={speech.isSupported}
          message={message}
          onRecognitionLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })}
          onStartGame={startGame}
          onOpenVocabManagement={() => dispatch({ type: 'SET_GAME_STATE', payload: 'vocab_management' })}
        />
      );
  }
};

export default App;
