import { create } from 'zustand'

type VocabAnswerState = {
  answer: string
  setAnswer: (answer: string) => void
}

const useVocabAnswerStore = create<VocabAnswerState>((set) => ({
  answer: '',
  setAnswer: (answer) => set({ answer }),
}))

const useVocabAnswer = () => {
  const answer = useVocabAnswerStore((s) => s.answer)
  const setAnswer = useVocabAnswerStore((s) => s.setAnswer)

  const isCorrect = (expected: string) => {
    return answer.trim().toLowerCase() === expected.trim().toLowerCase()
  }

  return { answer, setAnswer, isCorrect }
}

export default useVocabAnswer
export { useVocabAnswerStore }
