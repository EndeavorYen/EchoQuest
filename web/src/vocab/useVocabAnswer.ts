import { create } from 'zustand'

type VocabState = {
  answer: string
  setAnswer: (answer: string) => void
}

const useVocabStore = create<VocabState>((set) => ({
  answer: '',
  setAnswer: (answer) => set({ answer }),
}))

const useVocabAnswer = () => {
  const answer = useVocabStore((s) => s.answer)
  const setAnswer = useVocabStore((s) => s.setAnswer)

  const isCorrect = (expected: string) => {
    return answer.trim().toLowerCase() === expected.trim().toLowerCase()
  }

  return { answer, setAnswer, isCorrect }
}

export default useVocabAnswer
export { useVocabStore }
