// All code comments must be English per user requirement

function readInlineVocab() {
  try {
    const el = document.getElementById('vocab-inline');
    if (!el) return null;
    const text = el.textContent?.trim();
    if (!text) return null;
    const data = JSON.parse(text);
    return normalizeVocab(data);
  } catch (e) {
    console.warn('Inline vocab parse failed', e);
    return null;
  }
}

export async function loadVocabulary({ timeoutMs = 3000 } = {}) {
  // Strategy:
  // - If running from file://, prefer inline vocab (no server available).
  // - If running from http(s), try fetch('vocab.json') first; fallback to inline; then demo.
  const isFile = location.protocol === 'file:';
  const inline = readInlineVocab();

  if (isFile) {
    if (inline && inline.length) return inline;
    // file:// fetch may fail due to CORS; last resort to demo
    return demoVocab();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const res = await fetch('./vocab.json', { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`vocab.json status ${res.status}`);
    const data = await res.json();
    return normalizeVocab(data);
  } catch (e) {
    clearTimeout(timer);
    if (inline && inline.length) return inline;
    return demoVocab(e);
  }
}

function normalizeVocab(items) {
  // Ensure shape: { id, word, image, level }
  return items
    .map((x) => ({
      id: x.id || x.word,
      word: String(x.word || '').toLowerCase(),
      image: x.image,
      level: Number(x.level || 1),
    }))
    .filter((x) => x.word && x.image && Number.isFinite(x.level));
}

function demoVocab(err) {
  if (err) console.warn('Falling back to demo vocabulary', err);
  const demo = [
    { id: '001-basic/apple', word: 'apple', image: 'pics/001-basic/apple.svg', level: 1 },
    { id: '001-basic/cat', word: 'cat', image: 'pics/001-basic/cat.svg', level: 1 },
    { id: '002-animals/elephant', word: 'elephant', image: 'pics/002-animals/elephant.svg', level: 2 },
    { id: '003-objects/umbrella', word: 'umbrella', image: 'pics/003-objects/umbrella.svg', level: 3 },
  ];
  return normalizeVocab(demo);
}


