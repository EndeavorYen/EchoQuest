import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sword, Shield, Heart, Lock, Key, Mic, MicOff, Volume2, Star, Zap, Trophy, Skull, Sparkles, Settings, HelpCircle, SkipForward } from 'lucide-react';
import { VocabManager, VocabItem } from './components/VocabManager';

// Speech Recognition Hook
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      setTranscript(text);
    };

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  return {
    listening,
    transcript,
    start: () => recognitionRef.current?.start(),
    stop: () => recognitionRef.current?.stop(),
    resetTranscript: () => setTranscript(''),
  };
}


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


interface Level {
  id: number;
  name: string;
  type: 'boss' | 'puzzle';
  description: string;
  imageEmoji: string;
  requiredWords: number;
  enemyLives?: number;
  tools?: string[];
}

const App: React.FC = () => {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [levels, setLevels] = useState<Level[]>([
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
      name: '魔法之門',
      type: 'puzzle',
      description: '收集三個魔法工具來開啟大門！',
      imageEmoji: '🚪✨',
      requiredWords: 3,
      tools: ['key', 'hammer', 'magic'] // These should map to words in vocab
    }
  ]);

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
  const [isProcessing, setIsProcessing] = useState(false);

  const speech = useSpeechRecognition();

  // Load vocab on mount
  useEffect(() => {
    const storedVocab = loadVocabFromStorage();
    const initialVocab = storedVocab.length > 0 ? storedVocab : [
        // Difficulty 1
        { id: 'd1-1', word: 'apple', difficulty: 1, imageName: '🍎', enabled: true, size:0, type:'' },
        { id: 'd1-2', word: 'ball', difficulty: 1, imageName: '⚽', enabled: true, size:0, type:'' },
        { id: 'd1-3', word: 'cat', difficulty: 1, imageName: '🐱', enabled: true, size:0, type:'' },
        { id: 'd1-4', word: 'dog', difficulty: 1, imageName: '🐶', enabled: true, size:0, type:'' },
        { id: 'd1-5', word: 'egg', difficulty: 1, imageName: '🥚', enabled: true, size:0, type:'' },
        { id: 'd1-6', word: 'fish', difficulty: 1, imageName: '🐟', enabled: true, size:0, type:'' },
        { id: 'd1-7', word: 'key', difficulty: 1, imageName: '🔑', enabled: true, size:0, type:'' },
        { id: 'd1-8', word: 'sun', difficulty: 1, imageName: '☀️', enabled: true, size:0, type:'' },

        // Difficulty 2
        { id: 'd2-1', word: 'banana', difficulty: 2, imageName: '🍌', enabled: true, size:0, type:'' },
        { id: 'd2-2', word: 'car', difficulty: 2, imageName: '🚗', enabled: true, size:0, type:'' },
        { id: 'd2-3', word: 'flower', difficulty: 2, imageName: '🌸', enabled: true, size:0, type:'' },
        { id: 'd2-4', word: 'guitar', difficulty: 2, imageName: '🎸', enabled: true, size:0, type:'' },
        { id: 'd2-5', word: 'hammer', difficulty: 2, imageName: '🔨', enabled: true, size:0, type:'' },
        { id: 'd2-6', word: 'lion', difficulty: 2, imageName: '🦁', enabled: true, size:0, type:'' },
        { id: 'd2-7', word: 'pizza', difficulty: 2, imageName: '🍕', enabled: true, size:0, type:'' },
        { id: 'd2-8', word: 'train', difficulty: 2, imageName: '🚆', enabled: true, size:0, type:'' },

        // Difficulty 3
        { id: 'd3-1', word: 'bicycle', difficulty: 3, imageName: '🚲', enabled: true, size:0, type:'' },
        { id: 'd3-2', word: 'camera', difficulty: 3, imageName: '📷', enabled: true, size:0, type:'' },
        { id: 'd3-3', word: 'computer', difficulty: 3, imageName: '💻', enabled: true, size:0, type:'' },
        { id: 'd3-4', word: 'elephant', difficulty: 3, imageName: '🐘', enabled: true, size:0, type:'' },
        { id: 'd3-5', word: 'house', difficulty: 3, imageName: '🏠', enabled: true, size:0, type:'' },
        { id: 'd3-6', word: 'magic', difficulty: 3, imageName: '✨', enabled: true, size:0, type:'' },
        { id: 'd3-7', word: 'strawberry', difficulty: 3, imageName: '🍓', enabled: true, size:0, type:'' },
        { id: 'd3-8', word: 'telescope', difficulty: 3, imageName: '🔭', enabled: true, size:0, type:'' },
    ];
    setVocab(initialVocab);
  }, []);

  // Persist vocab changes
  useEffect(() => {
    saveVocabToStorage(vocab);
  }, [vocab]);

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
    if (!currentWord || isProcessing) return;
    setIsProcessing(true);
    
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
              setIsProcessing(false);
            }, 1500);
          } else {
            setGameState('victory');
            setIsProcessing(false);
          }
        } else {
          setTimeout(() => {
            selectNewWord();
            setIsProcessing(false);
          }, 1500);
        }
      } else if (level.type === 'puzzle') {
        setCollectedTools([...collectedTools, currentWord.word]);
        setMessage(`獲得了 ${currentWord.word}!`);
        
        if (collectedTools.length + 1 >= (level.tools?.length || 0)) {
            if (currentLevel < levels.length - 1) {
                setTimeout(() => {
                  setCurrentLevel(currentLevel + 1);
                  setMessage('謎題解開! 進入下一關!');
                  selectNewWord();
                  setIsProcessing(false);
                }, 1500);
              } else {
                setGameState('victory');
                setIsProcessing(false);
              }
        } else {
          setTimeout(() => {
            selectNewWord();
            setIsProcessing(false);
          }, 1500);
        }
      }
      
      setCorrectAnswers(correctAnswers + 1);
    } else {
      setMessage('再試一次!');
      setCombo(0);
      setIsProcessing(false);
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
                    className={`p-3 rounded-lg transition-colors ${
                      isVoiceMode ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                  >
                    {isVoiceMode ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  
                  {isVoiceMode ? (
                    <button
                      onMouseDown={() => {
                        setIsRecording(true);
                        speech.start();
                      }}
                      onMouseUp={() => {
                        setIsRecording(false);
                        speech.stop();
                      }}
                      disabled={speech.listening || isProcessing}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Volume2 className="w-5 h-5" />
                      {isProcessing ? '處理中...' : isRecording ? (speech.listening ? '聆聽中...' : '請稍候...') : '按住說話'}
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
                        className="p-3 rounded-lg bg-yellow-400 text-white hover:bg-yellow-500"
                        onMouseDown={() => setShowHint(true)}
                        onMouseUp={() => setShowHint(false)}
                        onTouchStart={() => setShowHint(true)}
                        onTouchEnd={() => setShowHint(false)}
                    >
                        <HelpCircle className="w-6 h-6" />
                    </button>
                    <button onClick={handleSkip} className="p-3 rounded-lg bg-gray-400 text-white hover:bg-gray-500">
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