import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import Game from './Game'

beforeAll(() => {
  // jsdom doesn't implement canvas; stub getContext to avoid errors
  HTMLCanvasElement.prototype.getContext = () => null
})

describe('Game', () => {
  it('renders canvas', () => {
    const { container } = render(<Game />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
  })
})
