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
    <div className="flex flex-col items-center gap-3 p-4">
      <p className="text-lg">A cute boss appears! Say or type the word to deal damage.</p>
      <p>Boss HP: {bossHp}</p>
      <div className="flex gap-1" aria-label="boss hp">
        {Array.from({ length: Math.max(0, bossHp) }).map((_, i) => (
          <span key={i} role="img" aria-label="heart">❤️</span>
        ))}
      </div>
      {currentWord && (
        <img
          src={images[currentWord]}
          alt={currentWord}
          width={180}
          height={180}
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
        <button type="submit" className="px-3 py-1 bg-rose-200 rounded">
          Attack
        </button>
      </form>
    </div>
  )
}

export default BossLevel
