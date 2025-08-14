import { useState } from 'react'

interface BossLevelProps {
  onComplete: () => void
}

const BossLevel = ({ onComplete }: BossLevelProps) => {
  const [bossHp, setBossHp] = useState(3)
  const [answer, setAnswer] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (answer.trim().toLowerCase() === 'correct') {
      const next = bossHp - 1
      setBossHp(next)
      if (next <= 0) onComplete()
    }
    setAnswer('')
  }

  return (
    <div>
      <p>Boss HP: {bossHp}</p>
      <form onSubmit={handleSubmit}>
        <input
          aria-label="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button type="submit">Attack</button>
      </form>
    </div>
  )
}

export default BossLevel

