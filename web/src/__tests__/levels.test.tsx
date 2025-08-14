import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BossLevel from '../game/levels/BossLevel'
import DoorPuzzleLevel from '../game/levels/DoorPuzzleLevel'
import { useVocabAnswerStore } from '../vocab/useVocabAnswer'
import useVocabStore from '../vocab/useVocabStore'

afterEach(() => {
  useVocabAnswerStore.setState({ answer: '' })
  useVocabStore.setState({ images: {} })
})

describe('BossLevel', () => {
  it('reduces HP and triggers completion', () => {
    const onComplete = vi.fn()
    useVocabStore.setState({ images: { apple: '/apple.png' } })
    render(<BossLevel onComplete={onComplete} />)

    const input = screen.getAllByRole('textbox')[0]
    const attack = screen.getByRole('button', { name: /attack/i })

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.click(attack)
    expect(screen.getByText(/Boss HP: 2/)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.click(attack)
    expect(screen.getByText(/Boss HP: 1/)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.click(attack)
    expect(onComplete).toHaveBeenCalled()
  })
})

describe('DoorPuzzleLevel', () => {
  it('unlocks when tools match words', () => {
    const onComplete = vi.fn()
    render(<DoorPuzzleLevel onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('lock'), { target: { value: 'key' } })
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('nail'), { target: { value: 'hammer' } })
    expect(onComplete).toHaveBeenCalled()
  })
})
