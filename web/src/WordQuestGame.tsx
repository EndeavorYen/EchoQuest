import { useEffect, useState } from 'react'
import { Sword, Star } from 'lucide-react'
import useLocalVocab, { type VocabItem } from './vocab/useLocalVocab'
import useVocabAnswer from './vocab/useVocabAnswer'
import SpeechInput from './vocab/SpeechInput'
import TextInput from './vocab/TextInput'

const WordQuestGame = () => {
  const { getRandom } = useLocalVocab()
  const { setAnswer, isCorrect } = useVocabAnswer()
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory'>('menu')
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null)
  const [score, setScore] = useState(0)
  const [enemyLives, setEnemyLives] = useState(5)
  const [silentMode, setSilentMode] = useState(false)

  const selectNewWord = () => {
    const w = getRandom()
    setCurrentWord(w)
  }

  useEffect(() => {
    if (gameState === 'playing' && !currentWord) {
      selectNewWord()
    }
  }, [gameState, currentWord])

  const startGame = () => {
    setGameState('playing')
    setScore(0)
    setEnemyLives(5)
    setAnswer('')
    selectNewWord()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWord) return
    if (isCorrect(currentWord.word)) {
      const next = enemyLives - currentWord.difficulty
      setScore((s) => s + currentWord.difficulty * 10)
      if (next <= 0) {
        setGameState('victory')
        return
      }
      setEnemyLives(next)
      selectNewWord()
    }
    setAnswer('')
  }

  const renderMenu = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-purple-400 p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">EchoQuest</h1>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl hover:from-purple-600 hover:to-pink-600"
        >
          開始遊戲
        </button>
      </div>
    </div>
  )

  const renderGame = () => (
    <div className="min-h-screen bg-gradient-to-b from-purple-300 to-pink-300 p-6 flex flex-col items-center">
      <div className="flex gap-4 mb-6 text-gray-800">
        <span>分數: {score}</span>
        <span>怪物生命: {enemyLives}</span>
      </div>
      {currentWord && (
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
          <div className="text-8xl mb-4">{currentWord.image}</div>
          <div className="flex justify-center gap-1 mb-2" aria-label="difficulty">
            {Array.from({ length: currentWord.difficulty }).map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-500" fill="currentColor" />
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex items-center justify-center gap-2">
            {!silentMode && <SpeechInput />}
            <TextInput />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-500 text-white rounded-lg flex items-center gap-2"
            >
              <Sword className="w-4 h-4" /> 攻擊
            </button>
          </form>
          <div className="mt-3 text-sm text-gray-700">
            <label className="flex items-center gap-2 justify-center">
              <input
                type="checkbox"
                checked={silentMode}
                onChange={(e) => setSilentMode(e.target.checked)}
              />
              靜音模式
            </label>
          </div>
        </div>
      )}
    </div>
  )

  const renderVictory = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-yellow-300 to-orange-400 p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">勝利！</h1>
        <p className="text-2xl text-gray-600 mb-6">最終分數: {score}</p>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-xl hover:from-yellow-600 hover:to-orange-600"
        >
          再玩一次
        </button>
      </div>
    </div>
  )

  switch (gameState) {
    case 'menu':
      return renderMenu()
    case 'playing':
      return renderGame()
    case 'victory':
      return renderVictory()
    default:
      return null
  }
}

export default WordQuestGame
