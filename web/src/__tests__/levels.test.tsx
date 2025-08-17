import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BossLevel from '../game/levels/BossLevel'
import DoorPuzzleLevel from '../game/levels/DoorPuzzleLevel'
import { useVocabAnswerStore } from '../vocab/useVocabAnswer'
import useVocabStore from '../vocab/useVocabStore'
import { useGameStatsStore } from '../game/useGameStats'

afterEach(() => {
  useVocabAnswerStore.setState({ answer: '' })
  useVocabStore.setState({ images: {}, damage: 1, setLevel: () => {} })
  useGameStatsStore.setState({ score: 0, combo: 0, correct: 0 })
})

describe('BossLevel', () => {
  it('reduces HP and triggers completion', () => {
    const onComplete = vi.fn()
    useVocabStore.setState({ images: { apple: '/apple.svg' }, damage: 2, setLevel: () => {} })
    render(<BossLevel onComplete={onComplete} />)

    const input = screen.getAllByRole('textbox')[0]
    const attack = screen.getByRole('button', { name: /attack/i })

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.click(attack)
    expect(screen.getByText(/Boss HP: 3/)).toBeInTheDocument()

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
    useVocabStore.setState({
      images: {
        key: '/key.svg',
        hammer: '/hammer.svg',
        rope: '/rope.svg',
      },
      damage: 1,
      setLevel: () => {},
    })
    render(<DoorPuzzleLevel onComplete={onComplete} />)

    const input = screen.getAllByRole('textbox')[0]
    const button = screen.getByRole('button', { name: /unlock/i })

    fireEvent.change(input, { target: { value: 'key' } })
    fireEvent.click(button)
    fireEvent.change(input, { target: { value: 'hammer' } })
    fireEvent.click(button)
    fireEvent.change(input, { target: { value: 'rope' } })
    fireEvent.click(button)
    expect(onComplete).toHaveBeenCalled()
  })
})
