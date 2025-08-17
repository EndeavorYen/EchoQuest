export type LevelData = { words: Record<string, string>; damage: number }
export type VocabData = { levels: Record<string, LevelData> }

export type VocabItem = {
  word: string
  image: string
  difficulty: number
  enabled: boolean
  pathHint: string
}

// Support common formats but prefer SVG when multiple formats exist for the same word
// Note: Use src/assets so Vite can include them in the module graph
const files = import.meta.glob('/src/assets/vocab/*/*.{svg,webp,png,jpg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const EXT_PRIORITY = ['svg', 'webp', 'png', 'jpg'] as const

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

export function fileNameToWord(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return normalizeWord(base)
}

export function parseDifficultyFromPath(path: string): number {
  const seg = path.split('/').find((s) => /^\d{3}-/.test(s))
  if (seg) {
    const n = parseInt(seg.slice(0, 3), 10)
    if (!isNaN(n)) return Math.max(1, Math.min(5, n))
  }
  return 1
}

export function loadVocabItems(fileMap: Record<string, string> = files): VocabItem[] {
  const byFolderWord: Record<string, Record<string, Record<string, string>>> = {}

  for (const [path, src] of Object.entries(fileMap)) {
    const match = path.match(/\/vocab\/([^/]+)\/([^/.]+)\.(svg|webp|png|jpg)$/)
    if (!match) continue
    const folder = match[1]
    const fileName = match[2]
    const word = fileNameToWord(fileName)
    const ext = match[3]
    byFolderWord[folder] ||= {}
    byFolderWord[folder][word] ||= {}
    byFolderWord[folder][word][ext] = src
  }

  const items: VocabItem[] = []
  for (const [folder, wordsMap] of Object.entries(byFolderWord)) {
    const difficulty = parseDifficultyFromPath(folder)
    for (const [word, extMap] of Object.entries(wordsMap)) {
      for (const ext of EXT_PRIORITY) {
        if (extMap[ext]) {
          items.push({
            word,
            image: extMap[ext],
            difficulty,
            enabled: true,
            pathHint: folder,
          })
          break
        }
      }
    }
  }
  return items
}

export function loadVocab(fileMap: Record<string, string> = files): VocabData {
  const items = loadVocabItems(fileMap)
  const levels: Record<string, LevelData> = {}
  for (const item of items) {
    levels[item.pathHint] ||= { words: {}, damage: item.difficulty }
    levels[item.pathHint].words[item.word] = item.image
    levels[item.pathHint].damage = item.difficulty
  }
  return { levels }
}

export default loadVocab
