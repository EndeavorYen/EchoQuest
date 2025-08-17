import { create } from 'zustand'

export type GameStatsState = {
  score: number
  combo: number
  correct: number
  addCorrect: (difficulty: number) => void
  reset: () => void
  resetCombo: () => void
}

const useGameStatsStore = create<GameStatsState>((set) => ({
  score: 0,
  combo: 0,
  correct: 0,
  addCorrect: (difficulty) =>
    set((s) => ({
      score: s.score + difficulty * 10 * (s.combo + 1),
      combo: s.combo + 1,
      correct: s.correct + 1,
    })),
  reset: () => set({ score: 0, combo: 0, correct: 0 }),
  resetCombo: () => set({ combo: 0 }),
}))

const useGameStats = () => {
  const score = useGameStatsStore((s) => s.score)
  const combo = useGameStatsStore((s) => s.combo)
  const correct = useGameStatsStore((s) => s.correct)
  const addCorrect = useGameStatsStore((s) => s.addCorrect)
  const reset = useGameStatsStore((s) => s.reset)
  const resetCombo = useGameStatsStore((s) => s.resetCombo)
  return { score, combo, correct, addCorrect, reset, resetCombo }
}

export default useGameStats
export { useGameStatsStore }
