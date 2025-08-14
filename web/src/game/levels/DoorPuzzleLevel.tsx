import { useState } from 'react'
import useVocabStore from '../../vocab/useVocabStore'

interface DoorPuzzleLevelProps {
  onComplete: () => void
}

const pairs: Record<string, string> = {
  key: 'lock',
  hammer: 'nail',
}

const DoorPuzzleLevel = ({ onComplete }: DoorPuzzleLevelProps) => {
  const { images } = useVocabStore()
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
    <div className="flex flex-col gap-2">
      <p>The door is locked. Match each tool to open it.</p>
      {words.map((word) => (
        <div key={word} className="flex items-center gap-2">
          {images[word] ? (
            <img src={images[word]} alt={word} width={50} height={50} />
          ) : (
            <span>{word}</span>
          )}
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

