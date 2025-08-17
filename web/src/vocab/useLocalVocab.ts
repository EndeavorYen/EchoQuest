import { useEffect, useState } from 'react'

export type VocabItem = {
  id: string
  word: string
  image: string
  difficulty: number
  enabled: boolean
}

export const STORAGE_KEY = 'wordquest_vocab_v1'

export const defaultVocab: VocabItem[] = [
  { id: 'seed-apple', word: 'apple', image: '🍎', difficulty: 1, enabled: true },
  { id: 'seed-dog', word: 'dog', image: '🐶', difficulty: 1, enabled: true },
  { id: 'seed-cat', word: 'cat', image: '🐱', difficulty: 1, enabled: true },
  { id: 'seed-banana', word: 'banana', image: '🍌', difficulty: 2, enabled: true },
  { id: 'seed-lion', word: 'lion', image: '🦁', difficulty: 2, enabled: true },
  { id: 'seed-icecream', word: 'icecream', image: '🍦', difficulty: 3, enabled: true },
]

function load(): VocabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as VocabItem[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return defaultVocab
}

export default function useLocalVocab() {
  const [items, setItems] = useState<VocabItem[]>(load())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore write errors (e.g., quota exceeded)
    }
  }, [items])

  const getRandom = () => {
    const enabled = items.filter((i) => i.enabled)
    return enabled[Math.floor(Math.random() * enabled.length)] || null
  }

  return { items, setItems, getRandom }
}
