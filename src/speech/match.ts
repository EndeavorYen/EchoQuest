/**
 * Judging what the speech engine heard against the word we asked for.
 *
 * Browser speech recognition is built for sentences, so single words come
 * back as near-misses all the time ("read" → "red", "their" → "there").
 * We therefore look at every alternative the engine offers, accept known
 * homophones, and grade by similarity instead of a hard right/wrong.
 */

export type Tier = 'perfect' | 'good' | 'miss';

export interface Judgement {
  tier: Tier;
  /** 0..1 */
  score: number;
  /** the alternative that matched best, as heard */
  heard: string;
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** Groups of words the engine cannot tell apart by sound alone. */
const HOMOPHONES: string[][] = [
  ['their', 'there', 'theyre'],
  ['read', 'red', 'reed'],
  ['to', 'too', 'two'],
  ['for', 'four', 'fore'],
  ['eye', 'i', 'aye'],
  ['sea', 'see', 'c'],
  ['bee', 'be', 'b'],
  ['sun', 'son'],
  ['blue', 'blew'],
  ['eight', 'ate'],
  ['no', 'know'],
  ['one', 'won'],
  ['hour', 'our'],
  ['write', 'right', 'rite'],
  ['wear', 'where', 'ware'],
  ['flower', 'flour'],
  ['bear', 'bare'],
  ['pair', 'pear', 'pare'],
  ['meat', 'meet'],
  ['sail', 'sale'],
  ['tail', 'tale'],
  ['knight', 'night'],
  ['hair', 'hare'],
  ['mail', 'male'],
  ['plane', 'plain'],
  ['wait', 'weight'],
  ['whole', 'hole'],
  ['wood', 'would'],
  ['deer', 'dear'],
  ['dye', 'die'],
  ['fir', 'fur'],
  ['peace', 'piece'],
  ['road', 'rode'],
  ['team', 'teem'],
  ['week', 'weak'],
];

const HOMOPHONE_INDEX = new Map<string, Set<string>>();
for (const group of HOMOPHONES) {
  const set = new Set(group);
  for (const w of group) HOMOPHONE_INDEX.set(w, set);
}

export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[0-9]+/g, (d) => {
      const n = parseInt(d, 10);
      return n >= 0 && n <= 20 ? NUMBER_WORDS[n] : d;
    })
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Score a single heard phrase against the target. */
function scorePhrase(target: string, phrase: string): number {
  if (!phrase) return 0;
  if (phrase === target) return 1;
  const tokens = phrase.split(' ');
  // the engine often wraps a single word in extra words ("the apple")
  if (tokens.includes(target)) return 1;
  const homs = HOMOPHONE_INDEX.get(target);
  if (homs && (homs.has(phrase) || tokens.some((t) => homs.has(t)))) return 0.97;
  // multi-word targets ("ice cream"): compare against joined tokens too
  let best = similarity(target, phrase);
  for (const t of tokens) best = Math.max(best, similarity(target, t));
  if (tokens.length > 1) best = Math.max(best, similarity(target, tokens.join('')));
  return best;
}

/** Thresholds for "perfect" by learner level; kids get more slack. */
export function perfectThreshold(level: number): number {
  return [0.66, 0.66, 0.76, 0.82, 0.85][Math.max(0, Math.min(4, level))];
}

export function judge(targetRaw: string, candidates: string[], level: number): Judgement {
  const target = normalize(targetRaw);
  let best = { score: 0, heard: '' };
  for (const c of candidates) {
    const phrase = normalize(c);
    const s = scorePhrase(target, phrase);
    if (s > best.score) best = { score: s, heard: c.trim() };
  }
  const perfect = perfectThreshold(level);
  const good = perfect - 0.2;
  const tier: Tier = best.score >= perfect ? 'perfect' : best.score >= good ? 'good' : 'miss';
  return { tier, score: best.score, heard: best.heard || (candidates[0] ?? '') };
}
