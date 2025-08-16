import { useEffect, useRef, useState } from 'react'

interface RecognitionEvent {
  results: Array<Array<{ transcript: string }>>
}

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export interface SpeechHook {
  supported: boolean
  listening: boolean
  transcript: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

export default function useSpeechRecognition(): SpeechHook {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)

  useEffect(() => {
    const { SpeechRecognition, webkitSpeechRecognition } =
      window as SpeechRecognitionWindow
    const ctor = SpeechRecognition || webkitSpeechRecognition
    setSupported(Boolean(ctor))
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop()
        } catch {
          /* ignore */
        }
        recRef.current = null
      }
    }
  }, [])

  const start = () => {
    if (!supported || listening) return
    const { SpeechRecognition, webkitSpeechRecognition } =
      window as SpeechRecognitionWindow
    const Ctor = SpeechRecognition || webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onstart = () => {
      setTranscript('')
      setError(null)
      setListening(true)
    }
    rec.onerror = (e: { error: string }) => {
      setError(e.error || 'speech_error')
    }
    rec.onresult = (e: RecognitionEvent) => {
      const t = e.results?.[0]?.[0]?.transcript || ''
      setTranscript(String(t))
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recRef.current = rec
    } catch (e) {
      setError((e as Error).message || 'speech_start_failed')
    }
  }

  const stop = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  const reset = () => setTranscript('')

  return { supported, listening, transcript, error, start, stop, reset }
}

