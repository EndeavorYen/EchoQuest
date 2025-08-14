import { useEffect, useMemo, useState } from 'react'
import SpeechInput from '../../vocab/SpeechInput'
import TextInput from '../../vocab/TextInput'
import useVocabAnswer from '../../vocab/useVocabAnswer'
import useVocabStore from '../../vocab/useVocabStore'

interface DoorPuzzleLevelProps {
  onComplete: () => void
}

const DoorPuzzleLevel = ({ onComplete }: DoorPuzzleLevelProps) => {
  const { images, setLevel } = useVocabStore()
  const { setAnswer, isCorrect } = useVocabAnswer()
  const [index, setIndex] = useState(0)
  const [silentMode, setSilentMode] = useState(false)

  useEffect(() => {
    setLevel('001-tools')
    setAnswer('')
    setIndex(0)
  }, [setLevel, setAnswer])

  const tools = useMemo(() => Object.keys(images).slice(0, 3), [images])
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
    <div className="flex flex-col items-center gap-3 p-4">
      <p className="text-lg">A cute locked door appears! Say or type the tool name to unlock it.</p>
      {current && images[current] && (
        <img
          src={images[current]}
          alt={current}
          width={160}
          height={160}
          className="rounded shadow"
        />
      )}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={silentMode}
            onChange={(e) => setSilentMode(e.target.checked)}
          />
          Silent Mode (keyboard only)
        </label>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        {!silentMode && <SpeechInput />}
        <TextInput />
        <button type="submit" className="px-3 py-1 bg-green-200 rounded">
          Unlock
        </button>
      </form>
      <p>
        {index + 1}/{tools.length}
      </p>
    </div>
  )
}

export default DoorPuzzleLevel
