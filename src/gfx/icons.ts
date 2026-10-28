import { makeSprite, T, type Sprite } from './fb';
import { C } from './palette';

/**
 * Tiny hand-drawn icons. Each row is a string; the letter picks a palette
 * colour. Hand-drawn on purpose — nothing here comes out of an image generator.
 */
const KEY: Record<string, number> = {
  '.': T,
  k: C.ink, w: C.snow, m: C.mist, s: C.slate, d: C.dusk,
  r: C.berry, o: C.orange, y: C.sun, g: C.lime, G: C.leaf, t: C.teal,
  b: C.sky, B: C.royal, n: C.navy, i: C.ice, p: C.plum,
};

export function fromRows(rows: string[]): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const s = makeSprite(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = KEY[row[x]];
      if (c !== undefined) s.px[y * w + x] = c;
    }
  });
  return s;
}

export const ICON = {
  mic: fromRows([
    '....kkk....',
    '...kwwwk...',
    '...kwmmk...',
    '...kwmmk...',
    '...kwmmk...',
    '.k.kwmmk.k.',
    '.kskwmmksk.',
    '.kssmmmssk.',
    '..kssssskk.',
    '...kkskk...',
    '.....k.....',
    '...kkkkk...',
  ]),
  shield: fromRows([
    '.kkkkkkkkk.',
    'kbbbbkBBBBk',
    'kbiibkBBBBk',
    'kbibbkBBBBk',
    'kbbbbkBBBBk',
    'kBBBBkbbbbk',
    'kBBBBkbbbbk',
    '.kBBBkbbbk.',
    '..kBBkbbk..',
    '...kBkbk...',
    '....kkk....',
  ]),
  sword: fromRows([
    '.........kk',
    '........kwk',
    '.......kwmk',
    '......kwmk.',
    '.....kwmk..',
    '.k..kwmk...',
    '.kykwmk....',
    '..kykk.....',
    '...kyk.....',
    '..kork.....',
    '.kork......',
    'kkk........',
  ]),
  heart: fromRows([
    '.kk...kk.',
    'krrk.krok',
    'krorrrrrk',
    'krrrrrrrk',
    '.krrrrrk.',
    '..krrrk..',
    '...krk...',
    '....k....',
  ]),
  heartEmpty: fromRows([
    '.kk...kk.',
    'ksdk.kdsk',
    'ksddddddk',
    'kddddddsk',
    '.kddddsk.',
    '..kddsk..',
    '...kdk...',
    '....k....',
  ]),
  star: fromRows([
    '....k....',
    '...kyk...',
    '...kyk...',
    'kkkkykkkk',
    'kyyyyyyyk',
    '.kyyyyyk.',
    '..kyyyk..',
    '.kyykyyk.',
    '.kyk.kyk.',
    '..k...k..',
  ]),
  speaker: fromRows([
    '....k.....',
    '...kw..k..',
    'kkkkw...k.',
    'kwwkw.k.k.',
    'kwwkw.k.k.',
    'kkkkw...k.',
    '...kw..k..',
    '....k.....',
  ]),
  check: fromRows([
    '.......kk',
    '......kgk',
    '.....kgk.',
    'kk..kgk..',
    'kgkkgk...',
    '.kggk....',
    '..kk.....',
  ]),
  lock: fromRows([
    '..kkkk..',
    '.ks..sk.',
    '.k....k.',
    'kkkkkkkk',
    'kyyyyyyk',
    'kyykkyyk',
    'kyyykyyk',
    'kkkkkkkk',
  ]),
  arrowL: fromRows([
    '...k',
    '..kw',
    '.kww',
    'kwww',
    '.kww',
    '..kw',
    '...k',
  ]),
  arrowR: fromRows([
    'k...',
    'wk..',
    'wwk.',
    'wwwk',
    'wwk.',
    'wk..',
    'k...',
  ]),
  kbd: fromRows([
    'kkkkkkkkkkk',
    'kwmwmwmwmwk',
    'kmwmwmwmwmk',
    'kwmkkkkkmwk',
    'kkkkkkkkkkk',
  ]),
  chest: fromRows([
    '..' + 'k'.repeat(10) + '..',
    '.k' + 'o'.repeat(10) + 'k.',
    'k' + 'o'.repeat(12) + 'k',
    'k'.repeat(14),
    'k' + 'y'.repeat(3) + 'k'.repeat(6) + 'y'.repeat(3) + 'k',
    'k' + 'o'.repeat(4) + 'kyyk' + 'o'.repeat(4) + 'k',
    'k' + 'o'.repeat(5) + 'kk' + 'o'.repeat(5) + 'k',
    'k' + 'o'.repeat(12) + 'k',
    '.' + 'k'.repeat(12) + '.',
  ]),
  skull: fromRows([
    '..kkkkkk..',
    '.kwwwwwwk.',
    'kwwwwwwwwk',
    'kwkkwwkkwk',
    'kwkkwwkkwk',
    'kwwwkkwwwk',
    '.kwwwwwwk.',
    '..kwkwkwk.',
    '..kkkkkkk.',
  ]),
  question: fromRows([
    '..kkkk..',
    '.kwwwwk.',
    'kwk..kwk',
    '....kwk.',
    '...kwk..',
    '...kwk..',
    '........',
    '...kwk..',
    '....k...',
  ]),
  flag: fromRows([
    'kkkk....',
    'krrrkk..',
    'krrrrrk.',
    'krrrkk..',
    'kkkk....',
    'k.......',
    'k.......',
    'k.......',
  ]),
};

/** Row-length check used by tests: every row of an icon must have the same width. */
export function rowsAreUniform(rows: string[]): boolean {
  return rows.every((r) => r.length === rows[0].length);
}
