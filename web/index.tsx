import React, { useEffect, useState } from 'react';
import { Sword, Star, Mic, MicOff, Volume2, Trophy } from 'lucide-react';

interface VocabItem {
  id: string;
  word: string;
  difficulty: number;
  image: string; // emoji or data url
  enabled: boolean;
}

const STORAGE_KEY = 'wordquest_vocab_v1';

const seedVocab: VocabItem[] = [
  { id: 'seed-apple', word: 'apple', difficulty: 1, image: '🍎', enabled: true },
  { id: 'seed-dog', word: 'dog', difficulty: 1, image: '🐕', enabled: true },
  { id: 'seed-cat', word: 'cat', difficulty: 1, image: '🐱', enabled: true },
];

function loadVocab(): VocabItem[] {
  if (typeof localStorage === 'undefined') return seedVocab;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('failed to load vocab', e);
  }
  return seedVocab;
}

function saveVocab(items: VocabItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('failed to save vocab', e);
  }
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const useVocabulary = () => {
  const [items, setItems] = useState<VocabItem[]>(seedVocab);

  useEffect(() => {
    setItems(loadVocab());
  }, []);

  const addItem = (word: string, difficulty: number, image: string) => {
    const next = [...items, { id: uid(), word, difficulty, image, enabled: true }];
    setItems(next);
    saveVocab(next);
  };

  const toggleEnabled = (id: string) => {
    const next = items.map((v) => (v.id === id ? { ...v, enabled: !v.enabled } : v));
    setItems(next);
    saveVocab(next);
  };

  return { items, addItem, toggleEnabled };
};

const VocabManager: React.FC<{
  items: VocabItem[];
  addItem: (word: string, difficulty: number, image: string) => void;
  toggleEnabled: (id: string) => void;
}> = ({ items, addItem, toggleEnabled }) => {
  const [word, setWord] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [image, setImage] = useState('');

  const handleAdd = () => {
    if (!word) return;
    addItem(word.toLowerCase(), difficulty, image || '❓');
    setWord('');
    setDifficulty(1);
    setImage('');
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow mb-6">
      <h2 className="text-lg font-bold mb-4">單字管理</h2>
      <div className="flex gap-2 mb-4">
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="單字"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 w-20"
          placeholder="難度"
          type="number"
          min={1}
          max={5}
          value={difficulty}
          onChange={(e) => setDifficulty(parseInt(e.target.value) || 1)}
        />
        <input
          className="border rounded px-2 py-1 w-20"
          placeholder="圖示"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
        <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={handleAdd}>
          新增
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((v) => (
          <li key={v.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.enabled}
              onChange={() => toggleEnabled(v.id)}
            />
            <span className="w-6 text-center">{v.image}</span>
            <span className="flex-1">{v.word}</span>
            <span className="text-xs text-gray-500">Lv.{v.difficulty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const WordQuestGame: React.FC = () => {
  const { items: vocab, addItem, toggleEnabled } = useVocabulary();
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory'>('menu');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  useEffect(() => {
    if (gameState === 'playing' && !currentWord) {
      selectNewWord();
    }
  }, [gameState, currentWord, vocab]);

  const selectNewWord = () => {
    const available = vocab.filter((v) => v.enabled);
    if (available.length === 0) return;
    const random = available[Math.floor(Math.random() * available.length)];
    setCurrentWord(random);
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCorrectAnswers(0);
    setMessage('');
    setCurrentWord(null);
  };

  const handleSubmit = () => {
    if (!currentWord) return;
    const ok = userInput.toLowerCase().trim() === currentWord.word.toLowerCase();
    if (ok) {
      setScore(score + currentWord.difficulty * 10);
      setCorrectAnswers(correctAnswers + 1);
      setMessage('答對了!');
      setUserInput('');
      selectNewWord();
    } else {
      setMessage('再試一次');
    }
  };

  const renderMenu = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-purple-400">
      <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">單字冒險</h1>
        <button className="px-6 py-3 bg-purple-500 text-white rounded-lg" onClick={startGame}>
          開始遊戲
        </button>
      </div>
    </div>
  );

  const renderVictory = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-yellow-300 to-orange-400">
      <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">勝利！</h1>
        <p className="mb-4">最終分數: {score}</p>
        <button className="px-6 py-3 bg-yellow-500 text-white rounded-lg" onClick={startGame}>
          再玩一次
        </button>
      </div>
    </div>
  );

  if (gameState === 'menu') return (
    <div>
      {renderMenu()}
      <div className="max-w-md mx-auto mt-8">
        <VocabManager items={vocab} addItem={addItem} toggleEnabled={toggleEnabled} />
      </div>
    </div>
  );

  if (gameState === 'victory') return renderVictory();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-purple-400 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div>分數: {score}</div>
            <div>答對: {correctAnswers}</div>
          </div>
          {currentWord && (
            <div className="text-center mb-4">
              <div className="text-8xl mb-2">{currentWord.image}</div>
              <div className="flex justify-center gap-1 mb-2">
                {[...Array(currentWord.difficulty)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-500" fill="currentColor" />
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 items-center justify-center mb-4">
            <button
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              className={`p-2 rounded ${isVoiceMode ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              {isVoiceMode ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            {isVoiceMode ? (
              <button className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-1" disabled>
                <Volume2 className="w-4 h-4" /> 語音模式
              </button>
            ) : (
              <>
                <input
                  className="px-3 py-2 border rounded"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="輸入英文單字"
                />
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-purple-500 text-white rounded flex items-center gap-1"
                >
                  <Sword className="w-4 h-4" /> 攻擊!
                </button>
              </>
            )}
          </div>
          {message && <div className="text-center text-purple-600 font-bold">{message}</div>}
        </div>
      </div>
    </div>
  );
};

export default WordQuestGame;
