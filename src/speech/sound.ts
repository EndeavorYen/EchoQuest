/**
 * "Sounds like" keys for short English words.
 *
 * Speech engines are built for sentences: a lone "egg" comes back as "ag", "eg",
 * "ex", "X" … Spelling distance says those are far apart, but they sound almost
 * the same. The key below squeezes a word down to roughly how it sounds:
 *  - every vowel becomes one vowel (kids and engines both blur short vowels),
 *    and vowels after the first sound are dropped;
 *  - consonants that sound alike share a letter (b/p, d/t, g/k/c, f/v, s/z, sh/ch/j …);
 *  - silent letters and doubles go away.
 * It is deliberately generous: the game is practice, not an exam.
 */

const LETTER_NAMES: Record<string, string> = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay',
  k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee',
  u: 'you', v: 'vee', w: 'double you', x: 'eks', y: 'why', z: 'zee',
};

const VOWELS = 'aeiou';

/** Key for one word (letters only, lowercase). */
export function soundKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  // a lone letter is spoken as its name ("x" → "eks")
  if (w.length === 1 && LETTER_NAMES[w]) w = LETTER_NAMES[w].replace(/ /g, '');
  // silent starts
  w = w.replace(/^(kn|gn|pn|wr)/, (m) => m[1]).replace(/^ps/, 's').replace(/^wh/, 'w').replace(/^x/, 's');
  // a few spelling → sound shortcuts
  w = w
    .replace(/tch/g, 'ch')
    .replace(/dge/g, 'j')
    .replace(/ck/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/gh/g, '')
    .replace(/mb$/g, 'm')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks')
    .replace(/(sh|ch|tion|sion|ture)/g, 'X')
    .replace(/th/g, 't')
    .replace(/ng/g, 'n')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/e$/g, ''); // silent final e ("age", "cake")

  const out: string[] = [];
  let sawSound = false;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    let k: string;
    if (ch === 'X') k = 'X';
    else if (VOWELS.includes(ch)) {
      // only the first vowel survives, and only at the very start of the word
      k = !sawSound ? 'A' : '';
    } else if ('bp'.includes(ch)) k = 'P';
    else if ('dt'.includes(ch)) k = 'T';
    else if ('gkcq'.includes(ch)) k = 'K';
    else if ('fv'.includes(ch)) k = 'F';
    else if ('sz'.includes(ch)) k = 'S';
    else if (ch === 'j') k = 'X';
    else if (ch === 'h') k = i === 0 ? 'H' : '';
    else if ('wy'.includes(ch)) k = i === 0 || VOWELS.includes(w[i + 1] ?? '') ? ch.toUpperCase() : '';
    else k = ch.toUpperCase(); // l m n r
    if (k) {
      sawSound = true;
      if (out[out.length - 1] !== k) out.push(k);
    } else if (VOWELS.includes(ch)) sawSound = true;
  }
  return out.join('');
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
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

/** 0..1 — how alike two words sound. 1 means the keys are identical. */
export function soundSimilarity(a: string, b: string): number {
  const ka = soundKey(a);
  const kb = soundKey(b);
  const max = Math.max(ka.length, kb.length);
  if (max === 0) return 0;
  return 1 - lev(ka, kb) / max;
}

/** Keys that short are too easy to hit by accident ("a" vs "eye"), so they count for less. */
export function keyLength(word: string): number {
  return soundKey(word).length;
}
