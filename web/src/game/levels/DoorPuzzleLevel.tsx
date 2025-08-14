import { useState } from 'react'

interface DoorPuzzleLevelProps {
  onComplete: () => void
}

const pairs: Record<string, string> = {
  key: 'lock',
  hammer: 'nail',
}

const DoorPuzzleLevel = ({ onComplete }: DoorPuzzleLevelProps) => {
  const [choices, setChoices] = useState<Record<string, string>>({})

  const handleChange = (word: string, tool: string) => {
    const newChoices = { ...choices, [word]: tool }
    setChoices(newChoices)
    const solved = Object.entries(pairs).every(
      ([toolName, wordName]) => newChoices[wordName] === toolName
    )
    if (solved) onComplete()
  }

  const words = Object.values(pairs)
  const tools = Object.keys(pairs)

  return (
    <div>
      {words.map((word) => (
        <div key={word}>
          <span>{word}</span>
          <select
            aria-label={word}
            value={choices[word] || ''}
            onChange={(e) => handleChange(word, e.target.value)}
          >
            <option value="">Select</option>
            {tools.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

export default DoorPuzzleLevel

