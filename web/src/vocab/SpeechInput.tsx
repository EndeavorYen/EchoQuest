import { useEffect, useRef, useState } from 'react'
import useVocabAnswer from './useVocabAnswer'
import TextInput from './TextInput'

const SpeechInput = () => {
  const { setAnswer } = useVocabAnswer()
  const recognitionRef = useRef<any>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setAnswer(transcript)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [setAnswer])

  const start = () => {
    recognitionRef.current?.start()
  }

  if (!supported) {
    return <TextInput />
  }

  return (
    <button type="button" onClick={start}>
      Speak
    </button>
  )
}

export default SpeechInput
