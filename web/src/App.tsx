import React, { useEffect, useMemo, useRef, useReducer } from 'react';
import { Sword, Shield, Heart, Lock, Key, Mic, MicOff, Volume2, Star, Zap, Trophy, Skull, Sparkles, Settings, HelpCircle, SkipForward, Globe } from 'lucide-react';
import { VocabManager } from './components/VocabManager';
import type { VocabItem } from './types/vocab';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { defaultLevels, type Level } from './data/levels';
import { calculateBossReward, getAvailableWords, isAnswerCorrect, isLevelComplete, selectWord } from './game/gameLogic';
import { createInitialState, gameReducer } from './game/gameReducer';


// LocalStorage Utilities
const STORAGE_KEY_VOCAB = "echoquest_vocab_v1";
const STORAGE_KEY_LANG = "echoquest_lang_v1";

function loadVocabFromStorage(): VocabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOCAB);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveVocabToStorage(items: VocabItem[]) {
  localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(items));
}

function loadLangFromStorage(): string {
    return localStorage.getItem(STORAGE_KEY_LANG) || 'en-US';
}

function saveLangToStorage(lang: string) {
    localStorage.setItem(STORAGE_KEY_LANG, lang);
}

interface AppProps {
    initialVocab?: VocabItem[];
    initialLevels?: Level[];
}

const App: React.FC<AppProps> = ({ initialVocab: initialVocabProp, initialLevels = defaultLevels }) => {
  const [state, dispatch] = useReducer(gameReducer, createInitialState({
    levels: initialLevels,
    recognitionLang: loadLangFromStorage(),
  }));
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

  const handleSubmitRef = useRef<(submittedText: string) => void>(() => {});
  const acceptSpeechResultsRef = useRef(false);
  acceptSpeechResultsRef.current = gameState === 'playing' && practiceMode === 'voice';
  const speech = useSpeechRecognition({
    autoRestart: gameState === 'playing' && practiceMode === 'voice',
    onResult: (result) => {
      if (!acceptSpeechResultsRef.current) {
        return;
      }
      handleSubmitRef.current(result);
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
    const effectTimer = setTimeout(() => dispatch({ type: 'RESET_EFFECTS' }), 500);

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
    }, 1500);

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

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (!speech.isSupported && practiceMode === 'voice') {
      dispatch({ type: 'SET_PRACTICE_MODE', payload: 'spelling' });
    }
  }, [practiceMode, speech.isSupported]);

  useEffect(() => {
    if (speech.error && practiceMode === 'voice') {
      dispatch({ type: 'SET_PRACTICE_MODE', payload: 'spelling' });
    }
  }, [practiceMode, speech.error]);

  useEffect(() => {
    if (practiceMode !== 'voice' && speech.listening) {
      speech.stop();
    }
    if (practiceMode !== 'voice') {
      speech.resetTranscript();
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
    dispatch({ type: 'SKIP_WORD' });
    selectNewWord();
  };

  const renderGame = () => {
    const level = levels[currentLevel];
    const speechUnavailable = !speech.isSupported;
    const totalEnemyLives = level.enemyLives ?? enemyLives;
    const objectiveText = level.type === 'puzzle'
      ? `目標: 收集 ${collectedTools.length}/${level.tools?.length || level.requiredWords} 個工具`
      : `目標: 答對 ${levelCorrectAnswers}/${level.requiredWords} 個單字，或清空生命值 ${enemyLives}/${totalEnemyLives}`;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Trophy className="w-8 h-8 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-800">分數: {score}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                <span className="text-lg font-semibold text-gray-700">連擊 x{combo}</span>
              </div>
              <div className="text-sm font-semibold text-gray-600">
                跳過 {skippedWords} 次
              </div>
              <div className="flex items-center gap-4">
                <Star className="w-8 h-8 text-yellow-500" />
                <span className="text-xl font-bold text-gray-800">關卡 {currentLevel + 1}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:w-1/2">
              <h2 className="text-3xl font-bold text-center mb-2 text-purple-600">{level.name}</h2>
              <p className="text-center text-gray-600 mb-4">{level.description}</p>
              <p className="text-center text-indigo-700 font-semibold mb-4">{objectiveText}</p>

              <div className={`my-4 text-center text-9xl ${isBossShaking ? 'shake' : ''}`}>
                {level.imageEmoji}
              </div>

              {level.type === 'boss' && (
                <div className="flex justify-center items-center gap-2">
                  <Skull className="w-8 h-8 text-red-500" />
                  <div className="flex gap-1">
                    {[...Array(level.enemyLives)].map((_, i) => (
                      <Heart
                        key={i}
                        className={`w-8 h-8 ${i < enemyLives ? 'text-red-500' : 'text-gray-300'}`}
                        fill={i < enemyLives ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {level.type === 'puzzle' && (
                <div className="flex justify-center items-center gap-2 text-4xl">
                  {[...Array(level.tools ? level.tools.length - collectedTools.length : 0)].map((_, i) => (
                    <span key={i}>🚪</span>
                  ))}
                  {[...Array(collectedTools.length)].map((_, i) => (
                    <span key={i} className="opacity-50">🔑</span>
                  ))}
                </div>
              )}
            </div>

            {currentWord && (
              <div className="bg-white rounded-2xl shadow-xl p-8 md:w-1/2">
              <div className={`text-center mb-6 transition-all relative ${showEffect ? 'scale-110' : 'scale-100'}`}>
                {currentWord.imageDataUrl ? 
                    <img src={currentWord.imageDataUrl} alt={currentWord.word} className="w-40 h-40 object-cover rounded-xl border inline-block"/> :
                    <div className="text-8xl mb-4">{currentWord.imageName}</div>
                }
                <div className="flex justify-center gap-1 my-2">
                  {[...Array(currentWord.difficulty)].map((_, i) => (
                    <Star key={i} className="w-6 h-6 text-yellow-500" fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-gray-500">難度等級</p>
                {showHint && (
                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-xl">
                        <span className="text-white text-4xl font-bold">{currentWord.word}</span>
                    </div>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full text-center h-12 mb-2">
                    <p className="text-xl text-gray-500 h-full flex items-center justify-center">
                        <span className="text-purple-500 font-semibold">{speech.transcript}</span>
                        <span className="text-gray-400">{speech.interimTranscript}</span>
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      if (practiceMode === 'voice' || !speechUnavailable) {
                        if (practiceMode === 'spelling') {
                          speech.clearError();
                        }
                        dispatch({ type: 'TOGGLE_PRACTICE_MODE' });
                      }
                    }}
                    aria-label={practiceMode === 'voice' ? '切換到拼字模式' : '切換到語音模式'}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold ${
                      practiceMode === 'voice'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    } ${practiceMode === 'spelling' && speechUnavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={practiceMode === 'spelling' && speechUnavailable}
                  >
                    {practiceMode === 'voice' ? (
                      <>
                        <Mic className="w-5 h-5" />
                        <span>語音</span>
                      </>
                    ) : (
                      <>
                        <MicOff className="w-5 h-5" />
                        <span>拼字</span>
                      </>
                    )}
                  </button>
                  
                  {practiceMode === 'voice' ? (
                    <button
                      onClick={() => {
                        if (speech.listening) {
                          speech.stop();
                        } else {
                          speech.start(recognitionLang);
                        }
                      }}
                      disabled={speechUnavailable}
                      className={`px-6 py-3 text-white rounded-lg font-bold flex items-center gap-2 transition-colors ${
                        speech.listening
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-blue-500 hover:bg-blue-600'
                      } ${speechUnavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Volume2 className="w-5 h-5" />
                      {speech.listening ? '聆聽中...' : '點擊說話'}
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => dispatch({ type: 'SET_USER_INPUT', payload: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit(userInput)}
                      placeholder="輸入英文單字"
                      className="px-4 py-3 border-2 border-purple-300 rounded-lg text-lg focus:outline-none focus:border-purple-500"
                    />
                  )}
                   <LanguageSelector selectedLang={recognitionLang} onLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })} />
                </div>

                {speech.error && (
                  <p className="text-sm text-red-500 text-center" role="alert">
                    Speech recognition error: {speech.error}
                  </p>
                )}
                {!speech.isSupported && (
                  <p className="text-sm text-gray-500 text-center" role="alert">
                    Speech recognition is not supported in this browser.
                  </p>
                )}

                {practiceMode === 'spelling' && (
                  <button
                    onClick={() => handleSubmit(userInput)}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold text-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all"
                  >
                    <Sword className="inline w-5 h-5 mr-2" />
                    攻擊!
                  </button>
                )}

                <div className="flex gap-4 items-center mt-4">
                    <button
                        aria-label="Show hint"
                        className="p-3 rounded-lg bg-yellow-400 text-white hover:bg-yellow-500"
                        onMouseDown={() => dispatch({ type: 'SET_SHOW_HINT', payload: true })}
                        onMouseUp={() => dispatch({ type: 'SET_SHOW_HINT', payload: false })}
                        onTouchStart={() => dispatch({ type: 'SET_SHOW_HINT', payload: true })}
                        onTouchEnd={() => dispatch({ type: 'SET_SHOW_HINT', payload: false })}
                    >
                        <HelpCircle className="w-6 h-6" />
                    </button>
                    <button aria-label="Skip word" onClick={handleSkip} className="p-3 rounded-lg bg-gray-400 text-white hover:bg-gray-500">
                        <SkipForward className="w-6 h-6" />
                    </button>
                </div>
              </div>
              
              {message && (
                <div className="mt-6 text-center">
                  <p className="text-xl font-bold text-purple-600 animate-bounce">
                    {message}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-purple-400 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full">
        <div className="text-center mb-8">
          <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">EchoQuest</h1>
          <p className="text-gray-600">學習英文，打敗怪物！</p>
        </div>
        <div className="mb-6 flex justify-center">
            <LanguageSelector selectedLang={recognitionLang} onLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })} isMenu={true} />
        </div>
        <button
          onClick={startGame}
          className="w-full mb-4 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all"
        >
          開始遊戲
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_GAME_STATE', payload: 'vocab_management' })}
          className="w-full py-3 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
        >
          <Settings className="w-5 h-5"/>
          字彙管理
        </button>
        {!speech.isSupported && (
          <p className="mt-4 text-center text-sm text-gray-600" role="alert">
            Speech recognition is not supported in this browser.
          </p>
        )}
        {message && (
          <p className="mt-4 text-center text-red-500 font-bold animate-bounce">
            {message}
          </p>
        )}
      </div>
    </div>
  );

  const renderVictory = () => (
    <div className="min-h-screen bg-gradient-to-b from-yellow-300 to-orange-400 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800 mb-4">勝利！</h1>
        <p className="text-2xl text-gray-600 mb-2">最終分數: {score}</p>
        <p className="text-lg text-gray-500 mb-6">答對 {correctAnswers} 個單字</p>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-xl hover:from-yellow-600 hover:to-orange-600"
        >
          再玩一次
        </button>
      </div>
    </div>
  );

  switch (gameState) {
    case 'menu':
      return renderMenu();
    case 'playing':
      return renderGame();
    case 'victory':
      return renderVictory();
    case 'vocab_management':
        return <VocabManager vocab={vocab} onVocabChange={(v) => dispatch({ type: 'SET_VOCAB', payload: v })} onGoBack={() => dispatch({ type: 'SET_GAME_STATE', payload: 'menu' })} />;
    default:
      return renderMenu();
  }
};

const LanguageSelector: React.FC<{selectedLang: string, onLangChange: (lang: string) => void, isMenu?: boolean}> = ({ selectedLang, onLangChange, isMenu = false }) => {
    const languages = [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'zh-TW', name: '中文 (繁體)' },
        { code: 'zh-CN', name: '中文 (简体)' },
    ];

    if (isMenu) {
        return (
            <div className="flex items-center gap-2">
                <Globe className="w-6 h-6 text-gray-600" />
                <select
                    value={selectedLang}
                    onChange={(e) => onLangChange(e.target.value)}
                    className="bg-gray-200 border-none rounded-lg text-gray-800 font-semibold py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                </select>
            </div>
        );
    }

    return (
        <select
            value={selectedLang}
            onChange={(e) => onLangChange(e.target.value)}
            className="p-3 rounded-lg bg-gray-200 text-gray-600"
            aria-label="Select recognition language"
        >
            {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
        </select>
    );
};

export default App;
