import { renderHook, act, render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useVocabAnswer, { useVocabStore } from './useVocabAnswer'
import SpeechInput from './SpeechInput'
import TextInput from './TextInput'

afterEach(() => {
  cleanup()
  useVocabStore.setState({ answer: '' })
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
    const original = (window as any).SpeechRecognition
    ;(window as any).SpeechRecognition = undefined

    const { container } = render(<SpeechInput />)
    expect(container.querySelector('input')).not.toBeNull()

    ;(window as any).SpeechRecognition = original
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
