import { useEffect, useRef, useState } from 'react'
import useVocabAnswer from './useVocabAnswer'
import TextInput from './TextInput'

const SpeechInput = () => {
  const { setAnswer } = useVocabAnswer()
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const speechWindow = window as typeof window & {
      webkitSpeechRecognition?: typeof SpeechRecognition
    }

    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognitionClass()
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
