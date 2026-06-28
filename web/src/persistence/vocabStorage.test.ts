import type { VocabItem } from '../types/vocab';
import {
  STORAGE_KEY_LANG,
  STORAGE_KEY_PROFILE,
  STORAGE_KEY_VOCAB,
  hydrateDefaultVocabArtwork,
  loadLangFromStorage,
  loadProfileFromStorage,
  loadVocabFromStorage,
  saveLangToStorage,
  saveProfileToStorage,
  saveVocabToStorage,
} from './vocabStorage';

describe('vocabStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates stored default vocabulary with bundled artwork', () => {
    const storedApple: VocabItem = {
      id: 'd1-1',
      word: 'apple',
      difficulty: 1,
      enabled: true,
      imageName: 'apple',
      size: 0,
      type: '',
    };

    expect(hydrateDefaultVocabArtwork([storedApple])).toEqual([
      expect.objectContaining({
        id: 'd1-1',
        word: 'apple',
        imageSrc: 'assets/generated/word-apple.png',
      }),
    ]);
  });

  it('returns an empty vocabulary list when stored JSON is invalid', () => {
    localStorage.setItem(STORAGE_KEY_VOCAB, '{not-json');

    expect(loadVocabFromStorage()).toEqual([]);
  });

  it('saves and loads custom vocabulary items', () => {
    const customItem: VocabItem = {
      id: 'custom-1',
      word: 'custom',
      difficulty: 2,
      enabled: true,
      imageName: 'custom.png',
      imageDataUrl: 'data:image/png;base64,custom',
      size: 12,
      type: 'image/png',
    };

    saveVocabToStorage([customItem]);

    expect(localStorage.getItem(STORAGE_KEY_VOCAB)).toBe(JSON.stringify([customItem]));
    expect(loadVocabFromStorage()).toEqual([customItem]);
  });

  it('loads the default language and saves selected language', () => {
    expect(loadLangFromStorage()).toBe('en-US');

    saveLangToStorage('en-GB');

    expect(localStorage.getItem(STORAGE_KEY_LANG)).toBe('en-GB');
    expect(loadLangFromStorage()).toBe('en-GB');
  });

  it('loads the default learner profile and saves selected profile', () => {
    expect(loadProfileFromStorage()).toBe('kid');

    saveProfileToStorage('toddler');

    expect(localStorage.getItem(STORAGE_KEY_PROFILE)).toBe('toddler');
    expect(loadProfileFromStorage()).toBe('toddler');
  });

  it('falls back to kid profile when stored profile is unknown', () => {
    localStorage.setItem(STORAGE_KEY_PROFILE, 'wizard');

    expect(loadProfileFromStorage()).toBe('kid');
  });
});
