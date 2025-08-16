import { useEffect } from 'react'
import useVocabAnswer from './useVocabAnswer'
import TextInput from './TextInput'
import useSpeechRecognition from './useSpeechRecognition'

const SpeechInput = () => {
  const { setAnswer } = useVocabAnswer()
  const speech = useSpeechRecognition()

  useEffect(() => {
    if (speech.transcript) {
      setAnswer(speech.transcript)
    }
  }, [speech.transcript, setAnswer])

  if (!speech.supported) {
    return <TextInput />
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={speech.listening ? speech.stop : speech.start}
        aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
        className="px-3 py-2 rounded-lg bg-pastelPurple text-gray-800 shadow hover:brightness-105 active:brightness-95 transition"
      >
        {speech.listening ? 'Stop' : 'Listen'}
      </button>
      {speech.listening && (
        <span className="text-sm text-rose-600">Listening...</span>
      )}
    </div>
  )
}

export default SpeechInput
