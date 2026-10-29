import { normalize } from './match';
import type { Word } from '../data/words';

/** How many remembered hearings one word keeps. */
export const MAX_ALIASES = 10;

export type Aliases = Record<string, string[]>;

/** Everything we already know the engine might return when this word is said correctly. */
export function knownHearings(aliases: Aliases, word: Word): string[] {
  return [...(word.heard ?? []), ...(aliases[word.id] ?? [])];
}

/**
 * A grown-up said "yes, that was right": remember what the engine returned so the
 * same mishearing passes next time. Learned per device, so it adapts to this
 * child's voice and accent. Phrases of more than two words are not worth keeping.
 */
export function learnHearing(aliases: Aliases, word: Word, heard: readonly string[]): Aliases {
  const have = aliases[word.id] ?? [];
  const target = normalize(word.w);
  const add = heard
    .slice(0, 3)
    .map(normalize)
    .filter((h) => h && h !== target && h.split(' ').length <= 2 && !have.includes(h));
  if (add.length === 0) return aliases;
  return { ...aliases, [word.id]: [...have, ...add].slice(-MAX_ALIASES) };
}
