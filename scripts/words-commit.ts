/**
 * npm run words:commit -- --note "why"
 * Records what changed in the packs since the last commit: appends a revision to
 * bankstate/ledger.json and rewrites bankstate/snapshot.json. Refuses if a word was deleted.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PACKS, ALL_WORDS } from '../src/data/bank';
import { validatePack, validateLinks, formatIssues } from '../src/data/validate';
import { diffBank, isEmpty, snapshotOf } from '../src/data/bankdiff';
import snapshot from '../src/data/bankstate/snapshot.json';
import ledger from '../src/data/bankstate/ledger.json';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const note = arg('--note') ?? '';
const issues = [...PACKS.flatMap((p) => validatePack(p, { strict: p.id !== 'starter' })), ...validateLinks(PACKS)];
const { change, problems } = diffBank(snapshot, ALL_WORDS);
if (issues.length || problems.length) {
  console.log(formatIssues([...issues, ...problems]));
  console.log('✗ fix these first (nothing was written)');
  process.exit(1);
}
if (isEmpty(change)) { console.log(`nothing to commit (rev ${snapshot.rev})`); process.exit(0); }
if (!note) { console.log('✗ add --note "what changed and why"'); process.exit(1); }

const rev = snapshot.rev + 1;
const entry = { rev, date: new Date().toISOString().slice(0, 10), note, ...change };
const file = (n: string) => fileURLToPath(new URL(`../src/data/bankstate/${n}`, import.meta.url));
writeFileSync(file('ledger.json'), JSON.stringify({ revs: [...ledger.revs, entry] }, null, 1) + '\n');
writeFileSync(file('snapshot.json'), JSON.stringify(snapshotOf(rev, ALL_WORDS), null, 0).replace(/,"/g, ',\n"') + '\n');
console.log(`✓ rev ${rev}: +${change.add.length} added, ${change.move.length} moved, ${change.retire.length} retired, ${change.revise.length} revised`);
