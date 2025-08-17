import useGameStats from '../game/useGameStats'

interface VictoryScreenProps {
  onRestart: () => void
}

const VictoryScreen = ({ onRestart }: VictoryScreenProps) => {
  const { score, correct } = useGameStats()
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-pastelGreen text-center">
      <div className="sprite sprite-hero mb-4" />
      <h1 className="text-4xl font-playful text-pastelPurple mb-4">Victory!</h1>
      <p className="mb-2 text-gray-800">Score: {score}</p>
      <p className="mb-8 text-gray-800">Correct Words: {correct}</p>
      <button
        onClick={onRestart}
        className="px-4 py-2 bg-pastelPink text-gray-700 rounded"
      >
        Play Again
      </button>
    </div>
  )
}

export default VictoryScreen
