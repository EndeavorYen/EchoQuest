import { normalize, similarity } from './match';
import type { Word } from '../data/words';

/** How many remembered hearings one word keeps. */
export const MAX_ALIASES = 10;

export type Aliases = Record<string, string[]>;

/**
 * Could the engine really have heard this word as that? A child tapping ✓ after saying "banana" for
 * "grandfather" must not teach the game that "banana" is right. Kept: a letter name for a short word
 * ("b" for bee, "c" for see), anything sharing the first or last letter ("ag" for egg), or anything
 * reasonably close in spelling. The tap still counts as right; only the remembering is careful.
 */
export function plausible(heard: string, target: string): boolean {
  const h = heard.replace(/\s+/g, '');
  const t = target.replace(/\s+/g, '');
  if (!h || !t) return false;
  if (h.length <= 2) return true;
  if (h[0] === t[0] || h[h.length - 1] === t[t.length - 1]) return true;
  return similarity(h, t) >= 0.4;
}

/** Everything we already know the engine might return when this word is said correctly. */
export function knownHearings(aliases: Aliases, word: Word): string[] {
  return [...(word.heard ?? []), ...(aliases[word.id] ?? [])];
}

/**
 * A grown-up said "yes, that was right": remember what the engine returned so the
 * same mishearing passes next time. Learned per device, so it adapts to this
 * child's voice and accent. Phrases of more than two words are not worth keeping.
 */
export function learnHearing(aliases: Aliases, word: Word, heard: readonly string[], opts: { strict?: boolean } = {}): Aliases {
  const have = aliases[word.id] ?? [];
  const target = normalize(word.w);
  const add = heard
    .slice(0, 3)
    .map(normalize)
    .filter((h) => h && h !== target && h.split(' ').length <= 2 && !have.includes(h) && (!opts.strict || plausible(h, target)));
  if (add.length === 0) return aliases;
  return { ...aliases, [word.id]: [...have, ...add].slice(-MAX_ALIASES) };
}
