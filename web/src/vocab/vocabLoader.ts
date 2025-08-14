export type VocabMap = Record<string, Record<string, string>>

const files = import.meta.glob('/public/vocab/*/*.{png,jpg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function loadVocab(fileMap: Record<string, string> = files): VocabMap {
  const vocab: VocabMap = {}
  for (const [path, src] of Object.entries(fileMap)) {
    const match = path.match(/\/vocab\/([^/]+)\/([^/.]+)\.(png|jpg|webp)$/)
    if (!match) continue
    const level = match[1]
    const word = match[2]
    if (!vocab[level]) vocab[level] = {}
    vocab[level][word] = src
  }
  return vocab
}

export default loadVocab
