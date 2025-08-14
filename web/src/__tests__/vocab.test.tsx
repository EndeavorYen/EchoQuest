import { render, fireEvent, renderHook, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import TextInput from '../vocab/TextInput'
import SpeechInput from '../vocab/SpeechInput'
import useVocabAnswer, { useVocabAnswerStore } from '../vocab/useVocabAnswer'
import loadVocab from '../vocab/vocabLoader'

afterEach(() => {
  cleanup()
  useVocabAnswerStore.setState({ answer: '' })
})

describe('TextInput', () => {
  it('updates answer in store', () => {
    const { getByRole } = render(<TextInput />)
    fireEvent.change(getByRole('textbox'), { target: { value: 'cat' } })
    const { result } = renderHook(() => useVocabAnswer())
    expect(result.current.answer).toBe('cat')
  })
})

describe('SpeechInput', () => {
  it('stores transcript when speech recognized', () => {
    class MockSpeechRecognition {
      public onresult: ((event: any) => void) | null = null
      lang = ''
      interimResults = false
      maxAlternatives = 1
      start() {
        this.onresult?.({ results: [[{ transcript: 'dog' }]] })
      }
      stop() {}
    }
    const speechWindow = window as any
    const original = speechWindow.SpeechRecognition
    speechWindow.SpeechRecognition = MockSpeechRecognition

    const { getByRole } = render(<SpeechInput />)
    fireEvent.click(getByRole('button', { name: /speak/i }))

    const { result } = renderHook(() => useVocabAnswer())
    expect(result.current.answer).toBe('dog')

    speechWindow.SpeechRecognition = original
  })
})

describe('vocabLoader', () => {
  it('parses images from file map', () => {
    const files = {
      '/public/vocab/easy/apple.png': '/public/vocab/easy/apple.png',
    }
    const vocab = loadVocab(files)
    expect(vocab.easy.apple).toMatch(/apple\.png$/)
  })
})
