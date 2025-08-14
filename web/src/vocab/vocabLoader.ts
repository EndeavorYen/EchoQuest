export type LevelData = { words: Record<string, string>; damage: number }
export type VocabData = { levels: Record<string, LevelData> }

const files = import.meta.glob('/public/vocab/*/*.{png,jpg,webp,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function loadVocab(fileMap: Record<string, string> = files): VocabData {
  const levels: Record<string, LevelData> = {}
  for (const [path, src] of Object.entries(fileMap)) {
    const match = path.match(/\/vocab\/([^/]+)\/([^/.]+)\.(png|jpg|webp|svg)$/)
    if (!match) continue
    const folder = match[1]
    const word = match[2]
    const levelMatch = folder.match(/^(\d+)-(.+)$/)
    const difficulty = levelMatch ? parseInt(levelMatch[1], 10) : 1
    if (!levels[folder]) {
      levels[folder] = { words: {}, damage: difficulty }
    }
    levels[folder].words[word] = src
  }
  return { levels }
}

export default loadVocab
