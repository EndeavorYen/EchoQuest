import { useEffect } from 'react'
import type { LevelComponent } from './LevelManager'
import LevelManager from './LevelManager'
import DoorPuzzleLevel from './levels/DoorPuzzleLevel'
import BossLevel from './levels/BossLevel'
import useGameStats from './useGameStats'

interface GameProps {
  onWin?: () => void
  onLose?: () => void
}

const Game = ({ onWin = () => {}, onLose = () => {} }: GameProps) => {
  // `onLose` is accepted for future game scenarios where a player may fail a level.
  // It is intentionally unused at the moment.
  void onLose
  const { score, combo, reset } = useGameStats()
  const levels: LevelComponent[] = [BossLevel, DoorPuzzleLevel]

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4 text-gray-800">
        <span>Score: {score}</span>
        <span>Combo: {combo}</span>
      </div>
      <LevelManager levels={levels} onFinish={onWin} />
    </div>
  )
}

export default Game
