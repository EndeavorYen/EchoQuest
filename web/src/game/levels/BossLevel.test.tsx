import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import BossLevel from './BossLevel'

describe('BossLevel', () => {
  it('subtracts boss HP on correct answers', () => {
    const onComplete = vi.fn()
    render(<BossLevel onComplete={onComplete} />)

    const input = screen.getByLabelText('answer')
    const button = screen.getByRole('button', { name: /attack/i })

    fireEvent.change(input, { target: { value: 'correct' } })
    fireEvent.click(button)
    expect(screen.getByText(/Boss HP: 2/)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'correct' } })
    fireEvent.click(button)
    expect(screen.getByText(/Boss HP: 1/)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'correct' } })
    fireEvent.click(button)
    expect(onComplete).toHaveBeenCalled()
  })
})

