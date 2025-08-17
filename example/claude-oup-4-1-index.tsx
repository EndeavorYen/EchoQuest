import React, { useState, useEffect } from 'react';
import { Sword, Shield, Heart, Lock, Key, Mic, MicOff, Volume2, Star, Zap, Trophy, Skull, Sparkles } from 'lucide-react';

interface Word {
  text: string;
  difficulty: number;
  image: string;
}

interface Level {
  id: number;
  name: string;
  type: 'boss' | 'puzzle';
  description: string;
  requiredWords: number;
  enemyLives?: number;
  tools?: string[];
}

const WordQuestGame: React.FC = () => {
  // Mock vocabulary data
  const vocabulary: Word[] = [
    { text: 'apple', difficulty: 1, image: '🍎' },
    { text: 'banana', difficulty: 1, image: '🍌' },
    { text: 'cat', difficulty: 1, image: '🐱' },
    { text: 'dog', difficulty: 1, image: '🐕' },
    { text: 'elephant', difficulty: 2, image: '🐘' },
    { text: 'flower', difficulty: 2, image: '🌸' },
    { text: 'guitar', difficulty: 2, image: '🎸' },
    { text: 'house', difficulty: 3, image: '🏠' },
    { text: 'ice cream', difficulty: 3, image: '🍦' },
    { text: 'key', difficulty: 1, image: '🔑' },
    { text: 'hammer', difficulty: 2, image: '🔨' },
    { text: 'magic', difficulty: 3, image: '✨' },
  ];

  const levels: Level[] = [
    {
      id: 1,
      name: '巨龍巢穴',
      type: 'boss',
      description: '打敗守護寶藏的巨龍！',
      requiredWords: 5,
      enemyLives: 5
    },
    {
      id: 2,
      name: '魔法之門',
      type: 'puzzle',
      description: '收集三個魔法工具來開啟大門！',
      requiredWords: 3,
      tools: ['key', 'hammer', 'magic']
    }
  ];

  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [enemyLives, setEnemyLives] = useState(5);
  const [collectedTools, setCollectedTools] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory' | 'gameover'>('menu');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showEffect, setShowEffect] = useState(false);
  const [combo, setCombo] = useState(0);

  useEffect(() => {
    if (gameState === 'playing' && !currentWord) {
      selectNewWord();
    }
  }, [gameState, currentWord]);

  const selectNewWord = () => {
    const level = levels[currentLevel];
    let availableWords = vocabulary;
    
    if (level.type === 'puzzle' && level.tools) {
      availableWords = vocabulary.filter(w => level.tools?.includes(w.text) && !collectedTools.includes(w.text));
    } else {
      availableWords = vocabulary.filter(w => !collectedTools.includes(w.text));
    }
    
    if (availableWords.length > 0) {
      const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
      setCurrentWord(randomWord);
    }
  };

  const startGame = () => {
    setGameState('playing');
    setCurrentLevel(0);
    setScore(0);
    setEnemyLives(5);
    setCollectedTools([]);
    setCorrectAnswers(0);
    setCombo(0);
    selectNewWord();
  };

  const handleSubmit = () => {
    if (!currentWord) return;
    
    const isCorrect = userInput.toLowerCase().trim() === currentWord.text.toLowerCase();
    
    if (isCorrect) {
      const points = currentWord.difficulty * 10 * (combo + 1);
      setScore(score + points);
      setCombo(combo + 1);
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 500);
      
      const level = levels[currentLevel];
      
      if (level.type === 'boss') {
        setEnemyLives(enemyLives - currentWord.difficulty);
        setMessage(`太棒了! 對怪物造成 ${currentWord.difficulty} 點傷害!`);
        
        if (enemyLives - currentWord.difficulty <= 0) {
          if (currentLevel < levels.length - 1) {
            setTimeout(() => {
              setCurrentLevel(currentLevel + 1);
              setEnemyLives(5);
              setMessage('關卡完成! 進入下一關!');
              selectNewWord();
            }, 1500);
          } else {
            setGameState('victory');
          }
        } else {
          setTimeout(() => selectNewWord(), 1500);
        }
      } else if (level.type === 'puzzle') {
        setCollectedTools([...collectedTools, currentWord.text]);
        setMessage(`獲得了 ${currentWord.text}!`);
        
        if (collectedTools.length + 1 >= (level.tools?.length || 0)) {
          setGameState('victory');
        } else {
          setTimeout(() => selectNewWord(), 1500);
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

  const simulateVoiceInput = () => {
    if (!currentWord) return;
    
    setIsListening(true);
    setMessage('聆聽中...');
    
    setTimeout(() => {
      // Simulate voice recognition (50% chance of correct)
      const isCorrect = Math.random() > 0.5;
      if (isCorrect) {
        setUserInput(currentWord.text);
        setMessage('語音識別成功!');
        setTimeout(() => handleSubmit(), 500);
      } else {
        setMessage('請再說一次!');
      }
      setIsListening(false);
    }, 2000);
  };

  const renderGame = () => {
    const level = levels[currentLevel];
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-300 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
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

          {/* Level Info */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-3xl font-bold text-center mb-2 text-purple-600">{level.name}</h2>
            <p className="text-center text-gray-600 mb-4">{level.description}</p>
            
            {level.type === 'boss' && (
              <div className="flex justify-center items-center gap-2">
                <Skull className="w-8 h-8 text-red-500" />
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
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
              <div className="flex justify-center items-center gap-4">
                <Lock className="w-8 h-8 text-gray-600" />
                {level.tools?.map((tool, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${collectedTools.includes(tool) ? 'bg-green-100' : 'bg-gray-100'}`}
                  >
                    {collectedTools.includes(tool) ? '✓' : '?'}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Word Challenge */}
          {currentWord && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <div className={`text-center mb-6 transition-all ${showEffect ? 'scale-110' : 'scale-100'}`}>
                <div className="text-8xl mb-4">{currentWord.image}</div>
                <div className="flex justify-center gap-1 mb-2">
                  {[...Array(currentWord.difficulty)].map((_, i) => (
                    <Star key={i} className="w-6 h-6 text-yellow-500" fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-gray-500">難度等級</p>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setIsVoiceMode(!isVoiceMode)}
                    className={`p-3 rounded-lg transition-colors ${
                      isVoiceMode ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isVoiceMode ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  
                  {isVoiceMode ? (
                    <button
                      onClick={simulateVoiceInput}
                      disabled={isListening}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Volume2 className="w-5 h-5" />
                      {isListening ? '聆聽中...' : '按住說話'}
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                      placeholder="輸入英文單字"
                      className="px-4 py-3 border-2 border-purple-300 rounded-lg text-lg focus:outline-none focus:border-purple-500"
                    />
                  )}
                </div>
                
                {!isVoiceMode && (
                  <button
                    onClick={handleSubmit}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold text-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all"
                  >
                    <Sword className="inline w-5 h-5 mr-2" />
                    攻擊!
                  </button>
                )}
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
    );
  };

  const renderMenu = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-purple-400 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full">
        <div className="text-center mb-8">
          <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">單字冒險</h1>
          <p className="text-gray-600">學習英文，打敗怪物！</p>
        </div>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all"
        >
          開始遊戲
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
    default:
      return renderMenu();
  }
};

export default WordQuestGame;