import { renderHook, act, render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useVocabAnswer, { useVocabAnswerStore } from './useVocabAnswer'
import SpeechInput from './SpeechInput'
import TextInput from './TextInput'

vi.mock('./vocabLoader', () => ({
  __esModule: true,
  default: () => ({
    easy: { apple: '/public/vocab/easy/apple.png' },
    hard: { banana: '/public/vocab/hard/banana.png' },
  }),
}))

import useVocabStore from './useVocabStore'

afterEach(() => {
  cleanup()
  useVocabAnswerStore.setState({ answer: '' })
  useVocabStore.getState().setLevel('easy')
})

describe('vocabLoader', () => {
  it('loads images from file map', async () => {
    const { loadVocab } = await vi.importActual<typeof import('./vocabLoader')>(
      './vocabLoader'
    )
    const files = {
      '/public/vocab/easy/apple.png': '/public/vocab/easy/apple.png',
      '/public/vocab/hard/banana.png': '/public/vocab/hard/banana.png',
    }
    const vocab = loadVocab(files)
    expect(Object.keys(vocab.easy)).toContain('apple')
    expect(vocab.easy.apple).toMatch(/apple\.png$/)
  })
})

describe('useVocabStore', () => {
  it('switches levels and exposes images', () => {
    const { result } = renderHook(() => useVocabStore())
    expect(result.current.images.apple).toBeDefined()
    act(() => result.current.setLevel('hard'))
    expect(result.current.images.banana).toBeDefined()
  })
})

describe('useVocabAnswer', () => {
  it('tracks answer and correctness', () => {
    const { result } = renderHook(() => useVocabAnswer())

    act(() => result.current.setAnswer('apple'))

    expect(result.current.answer).toBe('apple')
    expect(result.current.isCorrect('Apple')).toBe(true)
    expect(result.current.isCorrect('banana')).toBe(false)
  })
})

describe('SpeechInput', () => {
  it('falls back to TextInput when unsupported', () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: unknown
    }
    const original = speechWindow.SpeechRecognition
    speechWindow.SpeechRecognition = undefined

    const { container } = render(<SpeechInput />)
    expect(container.querySelector('input')).not.toBeNull()

    speechWindow.SpeechRecognition = original
  })
})

describe('TextInput', () => {
  it('updates answer in store', () => {
    const { getByRole } = render(<TextInput />)
    const input = getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'cat' } })

    const { result } = renderHook(() => useVocabAnswer())
    expect(result.current.answer).toBe('cat')
  })
})
