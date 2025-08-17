import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStatsStore } from '../game/useGameStats'

describe('useGameStats', () => {
  beforeEach(() => {
    useGameStatsStore.setState({ score: 0, combo: 0, correct: 0 })
  })

  it('adds score with combo multiplier', () => {
    const { addCorrect } = useGameStatsStore.getState()
    addCorrect(2)
    addCorrect(2)
    const { score, combo, correct } = useGameStatsStore.getState()
    expect(score).toBe(60)
    expect(combo).toBe(2)
    expect(correct).toBe(2)
  })

  it('resets combo', () => {
    const { addCorrect, resetCombo } = useGameStatsStore.getState()
    addCorrect(1)
    resetCombo()
    const { combo } = useGameStatsStore.getState()
    expect(combo).toBe(0)
  })
})
