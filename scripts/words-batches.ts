/**
 * npm run words:batches -- [--source cefrj] [--size 100] [--list file.txt --pack moe1200]
 *
 * Cuts a word source into batch files in words-work/batches/ for an agent (Gemini) to fill in.
 * Words already in the bank, or already skipped, are left out, so it is safe to run again.
 *  --source cefrj      data-source/cefrj-vocabulary-profile-1.5.csv (default)
 *  --list file.txt     one word per line, optionally "word<TAB>pos"; needs --pack
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { ALL_WORDS, wordId, type Pos } from '../src/data/bank';
import { CEFR_TO_LV } from '../src/data/validate';
import { root } from './lib/packfile';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const size = Number(arg('--size', '100'));
const listFile = arg('--list');
const pack = arg('--pack', listFile ? undefined : 'cefrj')!;
if (!pack) { console.log('✗ --list needs --pack <id>'); process.exit(1); }

const POS: Record<string, Pos | null> = {
  noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', pronoun: 'pron', preposition: 'prep', determiner: 'det',
  conjunction: 'conj', number: 'num', interjection: 'interj',
  'modal auxiliary': 'v', 'be-verb': 'v', 'do-verb': 'v', 'have-verb': 'v', 'infinitive-to': null,
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

interface Item { w: string; pos?: Pos; cefr?: string; alt?: string[]; lvChoices?: number[] }

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function fromCefrj(): Item[] {
  const rows = parseCsv(readFileSync(root('data-source/cefrj-vocabulary-profile-1.5.csv'), 'utf8')).slice(1).filter((r) => r[0]);
  const out: Item[] = [];
  for (const r of rows) {
    const pos = POS[r[1].trim()];
    if (!pos) continue;
    // "color/colour": spellings of one word. American spelling comes first in the list; keep the rest as hints.
    const forms = r[0].split('/').map((x) => stripAccents(x.trim()).toLowerCase()).filter(Boolean);
    const cefr = r[2].trim();
    out.push({ w: forms[0], pos, cefr, ...(forms.length > 1 ? { alt: forms.slice(1) } : {}), lvChoices: CEFR_TO_LV[cefr] });
  }
  return out;
}

function fromList(file: string): Item[] {
  return readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const [w, pos] = l.split('\t');
    return { w: w.toLowerCase(), ...(pos ? { pos: pos as Pos } : {}) };
  });
}

const skippedFile = root(`data-source/${pack}-skipped.json`);
const skipped = new Set<string>(existsSync(skippedFile) ? (JSON.parse(readFileSync(skippedFile, 'utf8')) as { id: string }[]).map((s) => s.id) : []);
const have = new Set(ALL_WORDS.map((w) => w.id));
const seen = new Set<string>();
let dropped = 0;
const items = (listFile ? fromList(listFile) : fromCefrj()).filter((it) => {
  if (!/^[a-z]/.test(it.w)) { dropped++; return false; } // contractions like 'm / 's are not words to teach
  const id = it.pos ? wordId(it.w, it.pos) : it.w;
  if (seen.has(id) || have.has(id) || skipped.has(id)) return false;
  seen.add(id);
  return true;
});
const rank = (c?: string) => ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf(c ?? '') + 1 || 9;
items.sort((a, b) => rank(a.cefr) - rank(b.cefr) || a.w.localeCompare(b.w));

const dir = root('words-work/batches');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.startsWith(`${pack}-`)) rmSync(`${dir}/${f}`);
const n = Math.ceil(items.length / size);
for (let i = 0; i < n; i++) {
  const chunk = items.slice(i * size, (i + 1) * size);
  const name = `${pack}-${String(i + 1).padStart(3, '0')}.json`;
  writeFileSync(`${dir}/${name}`, `{"pack":"${pack}","batch":${i + 1},"of":${n},"items":[\n${chunk.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`);
}
console.log(`✓ ${items.length} words → ${n} batch(es) in words-work/batches/ (${have.size} already in the bank, ${skipped.size} skipped earlier, ${dropped} contractions dropped)`);
