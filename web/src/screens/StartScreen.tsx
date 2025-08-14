import useVocabStore, { allVocab } from '../vocab/useVocabStore'

interface StartScreenProps {
  onStart: () => void
}

const StartScreen = ({ onStart }: StartScreenProps) => {
  const { level, setLevel } = useVocabStore()
  const levels = Object.keys(allVocab.levels)

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-pastelBlue text-center">
      <div className="sprite sprite-hero mb-4" />
      <h1 className="text-4xl font-playful text-pastelPurple mb-8">EchoQuest</h1>
      {levels.length > 0 && (
        <select
          aria-label="level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="mb-4 px-2 py-1 rounded text-gray-700"
        >
          {levels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={onStart}
        className="px-4 py-2 bg-pastelPink text-gray-700 rounded"
      >
        Start
      </button>
    </div>
  )
}

export default StartScreen
