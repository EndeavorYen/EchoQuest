import { useState } from 'react'
import Game from './game/Game'
import StartScreen from './screens/StartScreen'
import VictoryScreen from './screens/VictoryScreen'
import DefeatScreen from './screens/DefeatScreen'

type Screen = 'start' | 'playing' | 'victory' | 'defeat'

const App = () => {
  const [screen, setScreen] = useState<Screen>('start')

  const startGame = () => setScreen('playing')
  const handleWin = () => setScreen('victory')
  const handleLose = () => setScreen('defeat')
  const restart = () => setScreen('start')

  switch (screen) {
    case 'start':
      return <StartScreen onStart={startGame} />
    case 'playing':
      return <Game onWin={handleWin} onLose={handleLose} />
    case 'victory':
      return <VictoryScreen onRestart={restart} />
    case 'defeat':
      return <DefeatScreen onRestart={restart} />
    default:
      return null
  }
}

export default App
