import { create } from 'zustand'

type VocabAnswerState = {
  answer: string
  setAnswer: (answer: string) => void
}

const useVocabAnswerStore = create<VocabAnswerState>((set) => ({
  answer: '',
  setAnswer: (answer) => set({ answer }),
}))

function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

const useVocabAnswer = () => {
  const answer = useVocabAnswerStore((s) => s.answer)
  const setAnswer = useVocabAnswerStore((s) => s.setAnswer)

  const isCorrect = (expected: string) => {
    return normalizeWord(answer) === normalizeWord(expected)
  }

  return { answer, setAnswer, isCorrect }
}

export default useVocabAnswer
export { useVocabAnswerStore }
