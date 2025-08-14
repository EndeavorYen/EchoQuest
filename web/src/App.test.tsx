import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('increments counter on click', () => {
    render(<App />)
    const button = screen.getByRole('button')
    expect(button.textContent).toBe('count is 0')
    fireEvent.click(button)
    expect(button.textContent).toBe('count is 1')
  })
})
