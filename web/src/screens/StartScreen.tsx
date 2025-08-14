interface StartScreenProps {
  onStart: () => void
}

const StartScreen = ({ onStart }: StartScreenProps) => (
  <div className="flex flex-col items-center justify-center h-screen bg-pastelBlue text-center">
    <div className="sprite sprite-hero mb-4" />
    <h1 className="text-4xl font-playful text-pastelPurple mb-8">EchoQuest</h1>
    <button
      onClick={onStart}
      className="px-4 py-2 bg-pastelPink text-gray-700 rounded"
    >
      Start
    </button>
  </div>
)

export default StartScreen
