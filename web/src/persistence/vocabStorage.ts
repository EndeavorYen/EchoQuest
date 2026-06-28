import { initialVocab as defaultInitialVocab } from '../data/vocab';
import type { LearnerProfile } from '../game/challenges';
import type { VocabItem } from '../types/vocab';

export const STORAGE_KEY_VOCAB = 'echoquest_vocab_v1';
export const STORAGE_KEY_LANG = 'echoquest_lang_v1';
export const STORAGE_KEY_PROFILE = 'echoquest_profile_v1';

const DEFAULT_VOCAB_BY_ID = new Map(defaultInitialVocab.map((item) => [item.id, item]));
const DEFAULT_VOCAB_BY_WORD = new Map(defaultInitialVocab.map((item) => [item.word, item]));

export function hydrateDefaultVocabArtwork(items: VocabItem[]): VocabItem[] {
  return items.map((item) => {
    if (item.imageSrc || item.imageDataUrl) {
      return item;
    }

    const defaultById = DEFAULT_VOCAB_BY_ID.get(item.id);
    const defaultItem = defaultById?.word === item.word ? defaultById : DEFAULT_VOCAB_BY_WORD.get(item.word);

    return defaultItem?.imageSrc ? { ...item, imageSrc: defaultItem.imageSrc } : item;
  });
}

export function loadVocabFromStorage(): VocabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOCAB);
    if (!raw) return [];
    return hydrateDefaultVocabArtwork(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveVocabToStorage(items: VocabItem[]) {
  localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(items));
}

export function loadLangFromStorage(): string {
  return localStorage.getItem(STORAGE_KEY_LANG) || 'en-US';
}

export function saveLangToStorage(lang: string) {
  localStorage.setItem(STORAGE_KEY_LANG, lang);
}

export function loadProfileFromStorage(): LearnerProfile {
  const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
  return stored === 'toddler' || stored === 'adult' ? stored : 'kid';
}

export function saveProfileToStorage(profile: LearnerProfile) {
  localStorage.setItem(STORAGE_KEY_PROFILE, profile);
}
