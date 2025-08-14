interface DefeatScreenProps {
  onRestart: () => void
}

const DefeatScreen = ({ onRestart }: DefeatScreenProps) => (
  <div className="flex flex-col items-center justify-center h-screen bg-pastelPink text-center">
    <div className="sprite sprite-monster mb-4" />
    <h1 className="text-4xl font-playful text-pastelPurple mb-8">Game Over</h1>
    <button
      onClick={onRestart}
      className="px-4 py-2 bg-pastelBlue text-gray-700 rounded"
    >
      Try Again
    </button>
  </div>
)

export default DefeatScreen
