import React, { useEffect, useMemo, useRef, useReducer } from 'react';
import { Sword, Heart, Mic, MicOff, Volume2, Star, Zap, Trophy, Skull, Sparkles, Settings, HelpCircle, SkipForward, Globe } from 'lucide-react';
import { VocabManager } from './components/VocabManager';
import { IconButton, Panel, QuestButton, ScreenShell, StatBadge } from './components/QuestFrame';
import type { VocabItem } from './types/vocab';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { defaultLevels, type Level } from './data/levels';
import { calculateBossReward, getAvailableWords, isAnswerCorrect, isLevelComplete, selectWord } from './game/gameLogic';
import { createInitialState, gameReducer } from './game/gameReducer';


// LocalStorage Utilities
const STORAGE_KEY_VOCAB = "echoquest_vocab_v1";
const STORAGE_KEY_LANG = "echoquest_lang_v1";
const DEFAULT_VOCAB_BY_ID = new Map(defaultInitialVocab.map((item) => [item.id, item]));
const DEFAULT_VOCAB_BY_WORD = new Map(defaultInitialVocab.map((item) => [item.word, item]));

function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麥克風權限被阻擋，已切換到拼字模式。請允許麥克風後再試。';
    case 'network':
      return '語音辨識暫時無法連線，已切換到拼字模式。';
    case 'no-speech':
      return '沒有聽到聲音，已切換到拼字模式。';
    case 'audio-capture':
      return '找不到可用的麥克風，已切換到拼字模式。';
    default:
      return `語音辨識暫時無法使用，已切換到拼字模式。 (${error})`;
  }
}

function loadVocabFromStorage(): VocabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOCAB);
    if (!raw) return [];
    return hydrateDefaultVocabArtwork(JSON.parse(raw));
  } catch {
    return [];
  }
}

function hydrateDefaultVocabArtwork(items: VocabItem[]): VocabItem[] {
  return items.map((item) => {
    if (item.imageSrc || item.imageDataUrl) {
      return item;
    }

    const defaultById = DEFAULT_VOCAB_BY_ID.get(item.id);
    const defaultItem = defaultById?.word === item.word ? defaultById : DEFAULT_VOCAB_BY_WORD.get(item.word);

    return defaultItem?.imageSrc ? { ...item, imageSrc: defaultItem.imageSrc } : item;
  });
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
    const currentWordImageSrc = currentWord?.imageDataUrl ?? currentWord?.imageSrc;
    
    return (
      <ScreenShell screen="playing" label="EchoQuest 遊戲進行中">
        <div className="eq-game-shell">
          <div className="eq-hud" aria-label="冒險狀態">
            <StatBadge icon={<Trophy className="w-6 h-6" />} label="得分" value={`分數: ${score}`} tone="gold" />
            <StatBadge icon={<Zap className="w-6 h-6" />} label="節奏" value={`連擊 x${combo}`} tone="green" />
            <StatBadge icon={<SkipForward className="w-6 h-6" />} label="選擇" value={`跳過 ${skippedWords} 次`} tone="blue" />
            <StatBadge icon={<Star className="w-6 h-6" />} label="進度" value={`關卡 ${currentLevel + 1}`} tone="red" />
          </div>

          <div className="eq-game-grid">
            <Panel className="eq-level-panel">
              <p className="text-sm font-extrabold uppercase text-[color:var(--eq-muted)]">Quest Log</p>
              <h2 className="eq-display eq-level-title">{level.name}</h2>
              <p className="mt-2 text-[color:var(--eq-muted)]">{level.description}</p>
              <p className="eq-objective">{objectiveText}</p>

              <div className={`eq-enemy-figure ${isBossShaking ? 'shake' : ''}`}>
                {level.imageSrc ? (
                  <img src={level.imageSrc} alt={`${level.name} artwork`} className="eq-enemy-artwork" />
                ) : (
                  <span aria-hidden="true">{level.imageEmoji}</span>
                )}
              </div>

              {level.type === 'boss' && (
                <div className="flex justify-center items-center gap-2" aria-label="Boss health">
                  <Skull className="w-7 h-7 text-[color:var(--eq-rust)]" />
                  <div className="flex gap-1">
                    {[...Array(level.enemyLives ?? 0)].map((_, i) => (
                      <Heart
                        key={i}
                        className={`w-7 h-7 ${i < enemyLives ? 'text-[color:var(--eq-rust)]' : 'text-stone-300'}`}
                        fill={i < enemyLives ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {level.type === 'puzzle' && (
                <div className="flex justify-center items-center gap-2 text-4xl" aria-label="Puzzle progress">
                  {[...Array(level.tools ? level.tools.length - collectedTools.length : 0)].map((_, i) => (
                    <span key={i}>🚪</span>
                  ))}
                  {[...Array(collectedTools.length)].map((_, i) => (
                    <span key={i} className="opacity-50">🔑</span>
                  ))}
                </div>
              )}
            </Panel>

            {currentWord && (
              <Panel className="eq-challenge-panel">
                <div className={`eq-word-stage ${showEffect ? 'eq-word-stage--success' : ''}`}>
                  {currentWordImageSrc ? (
                    <img src={currentWordImageSrc} alt={currentWord.word} className="eq-word-photo" />
                  ) : (
                    <div className="eq-word-image" aria-hidden="true">{currentWord.imageName}</div>
                  )}
                  <div className="mt-4 flex justify-center gap-1">
                    {[...Array(currentWord.difficulty)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-[color:var(--eq-sun)]" fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-1 text-sm font-bold text-[color:var(--eq-muted)]">難度等級</p>
                  {showHint && (
                    <div className="eq-hint-overlay">
                      <span className="eq-display text-4xl font-extrabold">{currentWord.word}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="eq-transcript w-full">
                    <p className="text-xl">
                      <span className="font-extrabold text-[color:var(--eq-river)]">{speech.transcript}</span>
                      <span className="text-[color:var(--eq-muted)]">{speech.interimTranscript}</span>
                    </p>
                  </div>

                  <div className="eq-control-row">
                    <QuestButton
                      variant={practiceMode === 'voice' ? 'secondary' : 'quiet'}
                      onClick={() => {
                        if (practiceMode === 'voice' || !speechUnavailable) {
                          if (practiceMode === 'spelling') {
                            speech.clearError();
                          }
                          dispatch({ type: 'TOGGLE_PRACTICE_MODE' });
                        }
                      }}
                      aria-label={practiceMode === 'voice' ? '切換到拼字模式' : '切換到語音模式'}
                      disabled={practiceMode === 'spelling' && speechUnavailable}
                      icon={practiceMode === 'voice' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    >
                      {practiceMode === 'voice' ? '語音' : '拼字'}
                    </QuestButton>

                    {practiceMode === 'voice' ? (
                      <QuestButton
                        variant={speech.listening ? 'danger' : 'primary'}
                        onClick={() => {
                          if (speech.listening) {
                            speech.stop();
                          } else {
                            speech.start(recognitionLang);
                          }
                        }}
                        disabled={speechUnavailable}
                        icon={<Volume2 className="w-5 h-5" />}
                      >
                        {speech.listening ? '聆聽中...' : '點擊說話'}
                      </QuestButton>
                    ) : (
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => dispatch({ type: 'SET_USER_INPUT', payload: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(userInput)}
                        placeholder="輸入英文單字"
                        className="eq-input"
                      />
                    )}
                    <LanguageSelector selectedLang={recognitionLang} onLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })} />
                  </div>

                  {speech.error && (
                    <p className="text-sm text-[color:var(--eq-ruby)] text-center" role="alert">
                      {getSpeechErrorMessage(speech.error)}
                    </p>
                  )}
                  {!speech.isSupported && (
                    <p className="text-sm text-[color:var(--eq-muted)] text-center" role="alert">
                      Speech recognition is not supported in this browser.
                    </p>
                  )}

                  {practiceMode === 'spelling' && (
                    <QuestButton
                      variant="gold"
                      onClick={() => handleSubmit(userInput)}
                      icon={<Sword className="w-5 h-5" />}
                    >
                      攻擊!
                    </QuestButton>
                  )}

                  <div className="flex gap-3 items-center">
                    <IconButton
                      aria-label="Show hint"
                      onMouseDown={() => dispatch({ type: 'SET_SHOW_HINT', payload: true })}
                      onMouseUp={() => dispatch({ type: 'SET_SHOW_HINT', payload: false })}
                      onTouchStart={() => dispatch({ type: 'SET_SHOW_HINT', payload: true })}
                      onTouchEnd={() => dispatch({ type: 'SET_SHOW_HINT', payload: false })}
                    >
                      <HelpCircle className="w-6 h-6" />
                    </IconButton>
                    <IconButton aria-label="Skip word" onClick={handleSkip} variant="danger">
                      <SkipForward className="w-6 h-6" />
                    </IconButton>
                  </div>
                </div>

                {message && (
                  <div className="text-center">
                    <p className="eq-message animate-bounce">
                      {message}
                    </p>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </ScreenShell>
    );
  };

  const renderMenu = () => (
    <ScreenShell screen="menu" label="EchoQuest 主選單">
      <div className="eq-menu">
        <section>
          <div className="eq-menu__mark" aria-hidden="true">
            <Sparkles className="w-12 h-12" />
          </div>
          <h1 className="eq-display eq-menu__title">EchoQuest</h1>
          <p className="eq-menu__subtitle">學習英文，打敗怪物！</p>
        </section>

        <Panel className="p-6 sm:p-8">
          <div className="mb-6 flex justify-center">
            <LanguageSelector selectedLang={recognitionLang} onLangChange={(lang) => dispatch({ type: 'SET_RECOGNITION_LANG', payload: lang })} isMenu={true} />
          </div>
          <div className="eq-menu__actions">
            <QuestButton onClick={startGame} className="w-full" icon={<Sword className="w-5 h-5" />}>
              開始遊戲
            </QuestButton>
            <QuestButton
              variant="quiet"
              onClick={() => dispatch({ type: 'SET_GAME_STATE', payload: 'vocab_management' })}
              className="w-full"
              icon={<Settings className="w-5 h-5" />}
            >
              字彙管理
            </QuestButton>
          </div>
          {!speech.isSupported && (
            <p className="mt-4 text-center text-sm text-[color:var(--eq-muted)]" role="alert">
              Speech recognition is not supported in this browser.
            </p>
          )}
          {message && (
            <p className="eq-message text-center animate-bounce">
              {message}
            </p>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );

  const renderVictory = () => (
    <ScreenShell screen="victory" label="EchoQuest 勝利結果" className="grid place-items-center">
      <Panel className="w-full max-w-md p-8 text-center">
        <Trophy className="w-20 h-20 text-[color:var(--eq-sun)] mx-auto mb-4" />
        <h1 className="eq-display text-4xl font-extrabold text-[color:var(--eq-ink)] mb-4">勝利！</h1>
        <p className="text-2xl font-extrabold text-[color:var(--eq-river)] mb-2">最終分數: {score}</p>
        <p className="text-lg text-[color:var(--eq-muted)] mb-6">答對 {correctAnswers} 個單字</p>
        <QuestButton onClick={startGame} className="w-full" variant="gold" icon={<Trophy className="w-5 h-5" />}>
          再玩一次
        </QuestButton>
      </Panel>
    </ScreenShell>
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
                <Globe className="w-6 h-6 text-[color:var(--eq-river)]" />
                <select
                    value={selectedLang}
                    onChange={(e) => onLangChange(e.target.value)}
                    aria-label="Select recognition language"
                    className="eq-select"
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
            className="eq-select"
            aria-label="Select recognition language"
        >
            {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
        </select>
    );
};

export default App;
