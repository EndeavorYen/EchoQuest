import { useState } from 'react'

export type LevelComponent = React.ComponentType<{ onComplete: () => void }>

interface LevelManagerProps {
  levels: LevelComponent[]
  onFinish: () => void
}

const LevelManager = ({ levels, onFinish }: LevelManagerProps) => {
  const [index, setIndex] = useState(0)
  const CurrentLevel = levels[index]

  const handleComplete = () => {
    if (index < levels.length - 1) {
      setIndex((i) => i + 1)
    } else {
      onFinish()
    }
  }

  return <CurrentLevel onComplete={handleComplete} />
}

export default LevelManager

