import { create } from 'zustand'
import loadVocab, { type VocabData, type LevelData } from './vocabLoader'

const allVocab: VocabData = loadVocab()
const levelNames = Object.keys(allVocab.levels)
const defaultLevel = levelNames[0] || ''
const defaultData: LevelData = allVocab.levels[defaultLevel] || { words: {}, damage: 1 }

export type VocabState = {
  level: string
  images: Record<string, string>
  damage: number
  setLevel: (level: string) => void
}

const useVocabStore = create<VocabState>((set) => ({
  level: defaultLevel,
  images: defaultData.words,
  damage: defaultData.damage,
  setLevel: (level) => {
    const data = allVocab.levels[level] || { words: {}, damage: 1 }
    set({ level, images: data.words, damage: data.damage })
  },
}))

export default useVocabStore
export { allVocab }
