import { useEffect, useState } from 'react'
import SpeechInput from '../../vocab/SpeechInput'
import TextInput from '../../vocab/TextInput'
import useVocabAnswer from '../../vocab/useVocabAnswer'
import useVocabStore from '../../vocab/useVocabStore'

interface BossLevelProps {
  onComplete: () => void
}

const BossLevel = ({ onComplete }: BossLevelProps) => {
  const { images, damage, setLevel } = useVocabStore()
  const words = Object.keys(images)
  const [bossHp, setBossHp] = useState(5)
  const [index, setIndex] = useState(0)
  const { setAnswer, isCorrect } = useVocabAnswer()

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
    <div className="flex flex-col items-center gap-2">
      <p>The boss blocks your path! Say the word to attack.</p>
      <p>Boss HP: {bossHp}</p>
      {currentWord && (
        <img src={images[currentWord]} alt={currentWord} width={100} height={100} />
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <SpeechInput />
        <TextInput />
        <button type="submit">Attack</button>
      </form>
    </div>
  )
}

export default BossLevel
