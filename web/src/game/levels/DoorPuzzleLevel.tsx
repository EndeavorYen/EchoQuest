import { useEffect, useState } from 'react'
import SpeechInput from '../../vocab/SpeechInput'
import TextInput from '../../vocab/TextInput'
import useVocabAnswer from '../../vocab/useVocabAnswer'
import useVocabStore from '../../vocab/useVocabStore'

interface DoorPuzzleLevelProps {
  onComplete: () => void
}

const tools = ['key', 'hammer', 'rope']

const DoorPuzzleLevel = ({ onComplete }: DoorPuzzleLevelProps) => {
  const { images, setLevel } = useVocabStore()
  const { setAnswer, isCorrect } = useVocabAnswer()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setLevel('001-tools')
    setAnswer('')
    setIndex(0)
  }, [setLevel, setAnswer])

  const current = tools[index]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!current) return
    if (isCorrect(current)) {
      const next = index + 1
      if (next >= tools.length) {
        onComplete()
      } else {
        setIndex(next)
      }
    }
    setAnswer('')
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p>The door is locked. Name each tool to open it.</p>
      {current && images[current] && (
        <img src={images[current]} alt={current} width={100} height={100} />
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <SpeechInput />
        <TextInput />
        <button type="submit">Unlock</button>
      </form>
      <p>
        {index + 1}/{tools.length}
      </p>
    </div>
  )
}

export default DoorPuzzleLevel
