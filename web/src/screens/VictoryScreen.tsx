interface VictoryScreenProps {
  onRestart: () => void
}

const VictoryScreen = ({ onRestart }: VictoryScreenProps) => (
  <div className="flex flex-col items-center justify-center h-screen bg-pastelGreen text-center">
    <div className="sprite sprite-hero mb-4" />
    <h1 className="text-4xl font-playful text-pastelPurple mb-8">Victory!</h1>
    <button
      onClick={onRestart}
      className="px-4 py-2 bg-pastelPink text-gray-700 rounded"
    >
      Play Again
    </button>
  </div>
)

export default VictoryScreen
