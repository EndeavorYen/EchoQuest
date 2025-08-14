import type { LevelComponent } from './LevelManager'
import LevelManager from './LevelManager'
import DoorPuzzleLevel from './levels/DoorPuzzleLevel'
import BossLevel from './levels/BossLevel'

interface GameProps {
  onWin?: () => void
  onLose?: () => void
}

const Game = ({ onWin = () => {}, onLose = () => {} }: GameProps) => {
  // `onLose` is accepted for future game scenarios where a player may fail a level.
  // It is intentionally unused at the moment.
  void onLose
  const levels: LevelComponent[] = [DoorPuzzleLevel, BossLevel]

  return (
    <div className="flex flex-col items-center gap-4">
      <LevelManager levels={levels} onFinish={onWin} />
    </div>
  )
}

export default Game
