import { useEffect, useMemo, useState } from 'react'
import SpeechInput from '../../vocab/SpeechInput'
import TextInput from '../../vocab/TextInput'
import useVocabAnswer from '../../vocab/useVocabAnswer'
import useVocabStore from '../../vocab/useVocabStore'
import useGameStats from '../useGameStats'

interface DoorPuzzleLevelProps {
  onComplete: () => void
}

const DoorPuzzleLevel = ({ onComplete }: DoorPuzzleLevelProps) => {
  const { images, damage, setLevel } = useVocabStore()
  const { setAnswer, isCorrect } = useVocabAnswer()
  const { addCorrect, resetCombo } = useGameStats()
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
      addCorrect(damage)
      const next = index + 1
      if (next >= tools.length) {
        onComplete()
      } else {
        setIndex(next)
      }
    } else {
      resetCombo()
    }
    setAnswer('')
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="bg-white/70 backdrop-blur rounded-2xl shadow-xl p-6 max-w-md w-full text-center">
        <p className="text-xl font-playful text-gray-800 mb-2">A cute locked door appears! Say or type the tool name to unlock it.</p>
        {current && images[current] && (
          <img
            src={images[current]}
            alt={current}
            width={220}
            height={220}
            className="rounded-xl shadow-md mx-auto mb-4 bg-white object-contain"
          />
        )}
        <div className="flex items-center justify-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={silentMode}
              onChange={(e) => setSilentMode(e.target.checked)}
            />
            Silent Mode (keyboard only)
          </label>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 items-center justify-center">
          {!silentMode && <SpeechInput />}
          <TextInput />
          <button type="submit" className="px-4 py-2 rounded-lg bg-green-300 text-gray-800 shadow hover:brightness-105 active:brightness-95 transition">
            Unlock
          </button>
        </form>
        <p className="mt-3 text-sm text-gray-700">
          {index + 1}/{tools.length}
        </p>
      </div>
    </div>
  )
}

export default DoorPuzzleLevel
