import { useEffect, useRef, useState } from 'react'
import useVocabAnswer from './useVocabAnswer'
import TextInput from './TextInput'

type RecognitionEvent = {
  results: Array<Array<{ transcript: string }>>
}

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}

const SpeechInput = () => {
  const { setAnswer } = useVocabAnswer()
  const recognitionRef = useRef<Recognition | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => Recognition
      webkitSpeechRecognition?: new () => Recognition
    }

    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      setSupported(false)
      return
    }

    const recognition: Recognition = new SpeechRecognitionClass()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: RecognitionEvent) => {
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
    <button
      type="button"
      onClick={start}
      aria-label="Speak"
      className="px-3 py-2 rounded-lg bg-pastelPurple text-gray-800 shadow hover:brightness-105 active:brightness-95 transition"
    >
      🎤 Speak
    </button>
  )
}

export default SpeechInput
