export type LevelData = { words: Record<string, string>; damage: number }
export type VocabData = { levels: Record<string, LevelData> }

// Support common formats but prefer SVG when multiple formats exist for the same word
// Note: Use src/assets so Vite can include them in the module graph
const files = import.meta.glob('/src/assets/vocab/*/*.{svg,webp,png,jpg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const EXT_PRIORITY = ['svg', 'webp', 'png', 'jpg'] as const

export function loadVocab(fileMap: Record<string, string> = files): VocabData {
  const byFolderWord: Record<string, Record<string, Record<string, string>>> = {}

  for (const [path, src] of Object.entries(fileMap)) {
    const match = path.match(/\/vocab\/([^/]+)\/([^/.]+)\.(svg|webp|png|jpg)$/)
    if (!match) continue
    const folder = match[1]
    const word = match[2]
    const ext = match[3]
    byFolderWord[folder] ||= {}
    byFolderWord[folder][word] ||= {}
    byFolderWord[folder][word][ext] = src
  }

  const levels: Record<string, LevelData> = {}
  for (const [folder, wordsMap] of Object.entries(byFolderWord)) {
    const levelMatch = folder.match(/^(\d+)-(.+)$/)
    const difficulty = levelMatch ? parseInt(levelMatch[1], 10) : 1
    const words: Record<string, string> = {}

    for (const [word, extMap] of Object.entries(wordsMap)) {
      // pick best available by extension priority
      for (const ext of EXT_PRIORITY) {
        if (extMap[ext]) {
          words[word] = extMap[ext]
          break
        }
      }
    }

    levels[folder] = { words, damage: difficulty }
  }

  return { levels }
}

export default loadVocab
