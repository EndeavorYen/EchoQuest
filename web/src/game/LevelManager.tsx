import { useState } from 'react'

export type LevelComponent = React.ComponentType<{ onComplete: () => void }>

interface LevelManagerProps {
  levels: LevelComponent[]
}

const LevelManager = ({ levels }: LevelManagerProps) => {
  const [index, setIndex] = useState(0)
  const CurrentLevel = levels[index]

  const handleComplete = () => {
    setIndex((i) => Math.min(i + 1, levels.length - 1))
  }

  return <CurrentLevel onComplete={handleComplete} />
}

export default LevelManager

