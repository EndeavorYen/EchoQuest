import type { LevelComponent } from './LevelManager'
import LevelManager from './LevelManager'
import DoorPuzzleLevel from './levels/DoorPuzzleLevel'
import BossLevel from './levels/BossLevel'

interface GameProps {
  onWin?: () => void
}

const Game = ({ onWin = () => {} }: GameProps) => {
  const levels: LevelComponent[] = [DoorPuzzleLevel, BossLevel]

  return (
    <div className="flex flex-col items-center gap-4">
      <LevelManager levels={levels} onFinish={onWin} />
    </div>
  )
}

export default Game
