import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DoorPuzzleLevel from './DoorPuzzleLevel'

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

