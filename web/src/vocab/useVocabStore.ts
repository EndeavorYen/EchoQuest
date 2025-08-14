import { create } from 'zustand'
import loadVocab, { type VocabMap } from './vocabLoader'

const allVocab: VocabMap = loadVocab()
const defaultLevel = Object.keys(allVocab)[0] || ''

export type VocabState = {
  level: string
  images: Record<string, string>
  setLevel: (level: string) => void
}

const useVocabStore = create<VocabState>((set) => ({
  level: defaultLevel,
  images: allVocab[defaultLevel] || {},
  setLevel: (level) => set({ level, images: allVocab[level] || {} }),
}))

export default useVocabStore
export { allVocab }
