import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sword, Shield, Heart, Lock, Key, Mic, MicOff, Volume2, Star, Zap, Trophy, Skull, Sparkles, Settings, HelpCircle, SkipForward } from 'lucide-react';
import { VocabManager, VocabItem } from './components/VocabManager';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';


// LocalStorage Utilities
const STORAGE_KEY = "echoquest_vocab_v1";

function loadVocabFromStorage(): VocabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveVocabToStorage(items: VocabItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}


export interface Level { // Export for use in tests
  id: number;
  name: string;
  type: 'boss' | 'puzzle';
  description: string;
  imageEmoji: string;
  requiredWords: number;
  enemyLives?: number;
  tools?: string[];
}

// Define default levels so they can be exported or used as a default prop
const defaultLevels: Level[] = [
    {
      id: 1,
      name: '巨龍巢穴',
      type: 'boss',
      description: '打敗守護寶藏的巨龍！',
      imageEmoji: '🐉',
      requiredWords: 5,
      enemyLives: 5
    },
    {
      id: 2,
      name: '哥布林洞穴',
      type: 'boss',
      description: '一隻討厭的哥布林擋住了去路！',
      imageEmoji: '👺',
      requiredWords: 5,
      enemyLives: 3
    },
    {
      id: 3,
      name: '石像巨人山脈',
      type: 'boss',
      description: '巨大的石像巨人覺醒了！',
      imageEmoji: '🗿',
      requiredWords: 5,
      enemyLives: 8
    },
    {
      id: 4,
      name: '魔王城堡',
      type: 'boss',
      description: '最終挑戰：擊敗魔王！',
      imageEmoji: '👿',
      requiredWords: 5,
      enemyLives: 12
    },
    {
      id: 5,
      name: '魔法之門',
      type: 'puzzle',
      description: '收集三個魔法工具來開啟大門！',
      imageEmoji: '🚪✨',
      requiredWords: 3,
      tools: ['key', 'hammer', 'magic'] // These should map to words in vocab
    }
];

interface AppProps {
    initialVocab?: VocabItem[];
    initialLevels?: Level[];
}

const App: React.FC<AppProps> = ({ initialVocab: initialVocabProp, initialLevels = defaultLevels }) => {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [levels, setLevels] = useState<Level[]>(initialLevels);

  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [enemyLives, setEnemyLives] = useState(5);
  const [collectedTools, setCollectedTools] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory' | 'vocab_management'>('menu');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showEffect, setShowEffect] = useState(false);
  const [combo, setCombo] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isBossShaking, setIsBossShaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const speech = useSpeechRecognition();

  // Load vocab on mount or when prop changes
  useEffect(() => {
    if (initialVocabProp) {
        setVocab(initialVocabProp);
    } else {
        const storedVocab = loadVocabFromStorage();
        const initialVocab = storedVocab.length > 0 ? storedVocab : defaultInitialVocab;
        setVocab(initialVocab);
    }
  }, [initialVocabProp]);

  // Persist vocab changes, but only if not using props
  useEffect(() => {
    if (!initialVocabProp) {
        saveVocabToStorage(vocab);
    }
  }, [vocab, initialVocabProp]);

  const enabledVocab = useMemo(() => vocab.filter(v => v.enabled), [vocab]);

  useEffect(() => {
    if (gameState === 'playing' && !currentWord) {
      selectNewWord();
    }
  }, [gameState, currentWord]);

  // Handle speech recognition result
  useEffect(() => {
    if (speech.transcript && currentWord) {
      handleSubmit(speech.transcript);
      speech.resetTranscript();
    }
  }, [speech.transcript]);

  const selectNewWord = () => {
    if (enabledVocab.length === 0) {
        setMessage('請先到字彙管理新增單字!');
        setGameState('menu');
        return;
    }

    const level = levels[currentLevel];
    let availableWords = enabledVocab;
    
    if (level.type === 'puzzle' && level.tools) {
      availableWords = enabledVocab.filter(w => level.tools?.includes(w.word) && !collectedTools.includes(w.word));
    } 
    
    if (availableWords.length > 0) {
      const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
      setCurrentWord(randomWord);
    } else {
        // No more words for this level
        if (currentLevel < levels.length - 1) {
            setCurrentLevel(currentLevel + 1);
        } else {
            setGameState('victory');
        }
    }
  };

  const startGame = () => {
    setGameState('playing');
    setCurrentLevel(0);
    setScore(0);
    setEnemyLives(levels[0].enemyLives || 5);
    setCollectedTools([]);
    setCorrectAnswers(0);
    setCombo(0);
    selectNewWord();
  };

  const handleSubmit = (submittedText: string) => {
    if (!currentWord) return;
    
    const isCorrect = submittedText.toLowerCase().trim().replace(/[^a-z]/g, '') === currentWord.word;
    
    if (isCorrect) {
      const points = currentWord.difficulty * 10 * (combo + 1);
      setScore(score + points);
      setCombo(combo + 1);
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 500);
      
      const level = levels[currentLevel];
      
      if (level.type === 'boss') {
        const damage = currentWord.difficulty;
        setEnemyLives(enemyLives - damage);
        setMessage(`太棒了! 對怪物造成 ${damage} 點傷害!`);
        setIsBossShaking(true);
        setTimeout(() => setIsBossShaking(false), 500);
        
        if (enemyLives - damage <= 0) {
          if (currentLevel < levels.length - 1) {
            setTimeout(() => {
              setCurrentLevel(currentLevel + 1);
              setEnemyLives(levels[currentLevel + 1].enemyLives || 5);
              setMessage('關卡完成! 進入下一關!');
              selectNewWord();
            }, 1500);
          } else {
            setGameState('victory');
          }
        } else {
          setTimeout(() => {
            selectNewWord();
          }, 1500);
        }
      } else if (level.type === 'puzzle') {
        const newCollectedTools = [...collectedTools, currentWord.word];
        setCollectedTools(newCollectedTools);
        setMessage(`獲得了 ${currentWord.word}!`);
        
        if (newCollectedTools.length >= (level.tools?.length || 0)) {
            if (currentLevel < levels.length - 1) {
                setTimeout(() => {
                  setCurrentLevel(currentLevel + 1);
                  setEnemyLives(levels[currentLevel + 1].enemyLives || 5); // Set lives for next level if it's a boss
                  setMessage('謎題解開! 進入下一關!');
                  selectNewWord();
                }, 1500);
              } else {
                setGameState('victory');
              }
        } else {
          setTimeout(() => {
            selectNewWord();
          }, 1500);
        }
      }
      
      setCorrectAnswers(correctAnswers + 1);
    } else {
      setMessage('再試一次!');
      setCombo(0);
    }
    
    setUserInput('');
    setTimeout(() => setMessage(''), 2000);
  };

  const handleSkip = () => {
    setCombo(0);
    selectNewWord();
  };

  const renderGame = () => {
    const level = levels[currentLevel];
    
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
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setIsVoiceMode(!isVoiceMode)}
                    aria-label={isVoiceMode ? 'Switch to text input' : 'Switch to voice input'}
                    className={`p-3 rounded-lg transition-colors ${
                      isVoiceMode ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                  >
                    {isVoiceMode ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  
                  {isVoiceMode ? (
                    <button
                      onMouseDown={() => {
                        if (speech.listening) return;
                        setIsRecording(true);
                        speech.start();
                      }}
                      onMouseUp={() => {
                        if (!isRecording) return;
                        setIsRecording(false);
                        speech.stop();
                      }}
                      className={`px-6 py-3 bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 ${speech.listening ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    >
                      <Volume2 className="w-5 h-5" />
                      {isRecording ? (speech.listening ? '聆聽中...' : '請稍候...') : (speech.listening ? '處理中...' : '按住說話')}
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSubmit(userInput)}
                      placeholder="輸入英文單字"
                      className="px-4 py-3 border-2 border-purple-300 rounded-lg text-lg focus:outline-none focus:border-purple-500"
                    />
                  )}
                </div>
                
                {!isVoiceMode && (
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
                        onMouseDown={() => setShowHint(true)}
                        onMouseUp={() => setShowHint(false)}
                        onTouchStart={() => setShowHint(true)}
                        onTouchEnd={() => setShowHint(false)}
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
        <button
          onClick={startGame}
          className="w-full mb-4 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all"
        >
          開始遊戲
        </button>
        <button
          onClick={() => setGameState('vocab_management')}
          className="w-full py-3 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
        >
          <Settings className="w-5 h-5"/>
          字彙管理
        </button>
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
        return <VocabManager vocab={vocab} onVocabChange={setVocab} onGoBack={() => setGameState('menu')} />;
    default:
      return renderMenu();
  }
};

export default App;