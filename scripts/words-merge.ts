/**
 * npm run words:merge -- <agent-reply.json> [--batch words-work/batches/cefrj-001.json] [--pack cefrj]
 *
 * Takes what the agent (Gemini) returned — a JSON array of word entries — checks every entry
 * against the spec, and merges the good ones into src/data/packs/<pack>.json. Bad entries go to
 * words-work/rejects/ with the reasons, ready to be sent back to the agent. Nothing is ever
 * deleted from a pack: use {"w","pos","retired":true,"replacedBy"?} to retire a word.
 *
 * An entry is a patch: for a word that already exists only the fields you give change.
 * A new word needs all of w, pos, zh, lv, topic. `"skip": true` (+ "why") drops a word that
 * doesn't belong in a kids' game; it is recorded in data-source/<pack>-skipped.json so batches never offer it again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { wordId, type Pack, type PackWord, type Pos } from '../src/data/bank';
import { validatePack, formatIssues, type Issue } from '../src/data/validate';
import { readPack, writePack, root } from './lib/packfile';

const file = process.argv[2];
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
if (!file || file.startsWith('--')) { console.log('usage: words:merge <reply.json> [--batch batch.json] [--pack id]'); process.exit(1); }

const batch = arg('--batch') ? (JSON.parse(readFileSync(arg('--batch')!, 'utf8')) as { pack: string; items: { w: string; pos: Pos; cefr?: string }[] }) : null;
const packId = arg('--pack') ?? batch?.pack ?? 'cefrj';

type Entry = Partial<PackWord> & { w: string; pos: Pos; skip?: boolean; why?: string };
const text = readFileSync(file, 'utf8').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
let reply: Entry[];
try {
  const parsed = JSON.parse(text);
  reply = Array.isArray(parsed) ? parsed : parsed.words ?? parsed.items;
  if (!Array.isArray(reply)) throw new Error('expected a JSON array of entries');
} catch (e) {
  console.log(`✗ cannot read the reply as JSON: ${(e as Error).message}`);
  process.exit(1);
}

const pack: Pack = readPack(packId);
const index = new Map(pack.words.map((w, i) => [wordId(w.w, w.pos), i]));
const cefrOf = new Map((batch?.items ?? []).map((i) => [wordId(i.w, i.pos), i.cefr]));
const asked = new Set(cefrOf.keys());

const rejects: { entry: Entry; issues: Issue[] }[] = [];
const skippedFile = root(`data-source/${packId}-skipped.json`);
const skipped: { id: string; why: string }[] = existsSync(skippedFile) ? JSON.parse(readFileSync(skippedFile, 'utf8')) : [];
let added = 0, changed = 0, skips = 0;
const answered = new Set<string>();

for (const raw of reply) {
  const { skip, why, ...patch } = raw;
  const id = wordId(String(raw.w ?? ''), raw.pos);
  answered.add(id);
  if (skip) {
    if (!skipped.some((s) => s.id === id)) skipped.push({ id, why: why ?? '' });
    skips++;
    continue;
  }
  if (batch && !asked.has(id) && !index.has(id)) {
    rejects.push({ entry: raw, issues: [{ where: id, rule: 'unasked', msg: 'this word was not in the batch; entries must use the batch words exactly (same w and pos)' }] });
    continue;
  }
  const at = index.get(id);
  const cefr = cefrOf.get(id);
  const merged = { ...(at !== undefined ? pack.words[at] : {}), ...(cefr ? { cefr } : {}), ...patch, w: String(raw.w).trim().toLowerCase() } as PackWord;
  const issues = validatePack({ ...pack, words: [merged] }, { strict: !merged.retired });
  if (issues.length) { rejects.push({ entry: raw, issues }); continue; }
  if (at !== undefined) { pack.words[at] = merged; changed++; } else { index.set(id, pack.words.length); pack.words.push(merged); added++; }
}

const missing = [...asked].filter((id) => !answered.has(id) && !index.has(id));
writePack(pack);
if (skipped.length) writeFileSync(skippedFile, JSON.stringify(skipped, null, 1) + '\n');
console.log(`pack ${packId}: +${added} added, ${changed} changed, ${skips} skipped, ${rejects.length} rejected, ${missing.length} not answered`);
if (rejects.length || missing.length) {
  mkdirSync(root('words-work/rejects'), { recursive: true });
  const out = root(`words-work/rejects/${packId}-${Date.now()}.json`);
  writeFileSync(out, JSON.stringify({ rejected: rejects, notAnswered: missing }, null, 1) + '\n');
  console.log(formatIssues(rejects.flatMap((r) => r.issues)).split('\n').slice(0, 25).join('\n'));
  console.log(`→ ${rejects.length + missing.length} to redo; details in ${out}`);
  process.exit(1);
}
console.log('next: npm run words:commit -- --note "..."');
