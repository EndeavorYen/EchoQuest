import { useEffect, useMemo, useState } from 'react'
import SpeechInput from '../../vocab/SpeechInput'
import TextInput from '../../vocab/TextInput'
import useVocabAnswer from '../../vocab/useVocabAnswer'
import useVocabStore from '../../vocab/useVocabStore'

interface BossLevelProps {
  onComplete: () => void
}

const BossLevel = ({ onComplete }: BossLevelProps) => {
  const { images, damage, setLevel } = useVocabStore()
  const words = useMemo(() => Object.keys(images), [images])
  const [bossHp, setBossHp] = useState(5)
  const [index, setIndex] = useState(0)
  const { setAnswer, isCorrect } = useVocabAnswer()
  const [silentMode, setSilentMode] = useState(false)

  useEffect(() => {
    setLevel('002-fruits')
    setIndex(0)
    setAnswer('')
  }, [setLevel, setAnswer])

  const currentWord = words[index] || ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWord) return
    if (isCorrect(currentWord)) {
      const next = bossHp - damage
      setBossHp(next)
      if (next <= 0) {
        onComplete()
        return
      }
      setIndex((i) => (i + 1) % words.length)
    }
    setAnswer('')
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="bg-white/70 backdrop-blur rounded-2xl shadow-xl p-6 max-w-md w-full text-center">
        <p className="text-xl font-playful text-gray-800 mb-2">A cute boss appears! Say or type the word to deal damage.</p>
        <p className="mb-2">Boss HP: {bossHp}</p>
        <div className="flex justify-center gap-1 mb-4" aria-label="boss hp">
          {Array.from({ length: Math.max(0, bossHp) }).map((_, i) => (
            <span key={i} role="img" aria-label="heart" className="text-2xl">❤️</span>
          ))}
        </div>
        {currentWord && (
          <img
            src={images[currentWord]}
            alt={currentWord}
            width={240}
            height={240}
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
          <button type="submit" className="px-4 py-2 rounded-lg bg-rose-300 text-gray-800 shadow hover:brightness-105 active:brightness-95 transition">
            Attack
          </button>
        </form>
      </div>
    </div>
  )
}

export default BossLevel
