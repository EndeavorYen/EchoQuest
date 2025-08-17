import { useState } from 'react'
import Game from './game/Game'
import useGameStats from './game/useGameStats'
import { Sparkles, Trophy, Skull } from 'lucide-react'

const App = () => {
  const [state, setState] = useState<'menu' | 'playing' | 'victory' | 'defeat'>('menu')
  const { score, correct, reset } = useGameStats()

  const startGame = () => {
    reset()
    setState('playing')
  }

  const handleWin = () => setState('victory')
  const handleLose = () => setState('defeat')

  const renderMenu = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-purple-400 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800 mb-4">單字冒險</h1>
        <p className="text-gray-600 mb-8">學習英文，打敗怪物！</p>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-xl hover:from-purple-600 hover:to-pink-600"
        >
          開始遊戲
        </button>
      </div>
    </div>
  )

  const renderGame = () => <Game onWin={handleWin} onLose={handleLose} />

  const renderVictory = () => (
    <div className="min-h-screen bg-gradient-to-b from-yellow-300 to-orange-400 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800 mb-4">勝利！</h1>
        <p className="text-2xl text-gray-600 mb-2">最終分數: {score}</p>
        <p className="text-lg text-gray-500 mb-6">答對 {correct} 個單字</p>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-xl hover:from-yellow-600 hover:to-orange-600"
        >
          再玩一次
        </button>
      </div>
    </div>
  )

  const renderDefeat = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-300 to-gray-500 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <Skull className="w-24 h-24 text-gray-700 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800 mb-4">再接再厲！</h1>
        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-xl font-bold text-xl hover:from-gray-600 hover:to-gray-800"
        >
          再試一次
        </button>
      </div>
    </div>
  )

  switch (state) {
    case 'menu':
      return renderMenu()
    case 'playing':
      return renderGame()
    case 'victory':
      return renderVictory()
    case 'defeat':
      return renderDefeat()
    default:
      return renderMenu()
  }
}

export default App
