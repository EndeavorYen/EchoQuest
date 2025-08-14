import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import LevelManager, { type LevelComponent } from './LevelManager'

const LevelA: LevelComponent = ({ onComplete }) => (
  <button onClick={onComplete}>LevelA</button>
)
const LevelB: LevelComponent = () => <div>LevelB</div>

describe('LevelManager', () => {
  it('progresses through levels', () => {
    render(<LevelManager levels={[LevelA, LevelB]} />)
    expect(screen.getByText('LevelA')).toBeInTheDocument()
    fireEvent.click(screen.getByText('LevelA'))
    expect(screen.getByText('LevelB')).toBeInTheDocument()
  })
})

