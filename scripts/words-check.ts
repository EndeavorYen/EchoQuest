/** npm run words:check — validate every pack and make sure the committed change history matches them. */
import { PACKS, ALL_WORDS } from '../src/data/bank';
import { validatePack, validateLinks, formatIssues } from '../src/data/validate';
import { diffBank, isEmpty } from '../src/data/bankdiff';
import snapshot from '../src/data/bankstate/snapshot.json';

const issues = [...PACKS.flatMap((p) => validatePack(p, { strict: p.id !== 'starter' })), ...validateLinks(PACKS)];
const { change, problems } = diffBank(snapshot, ALL_WORDS);
let bad = false;
if (issues.length) { console.log(`✗ ${issues.length} problem(s) in packs:\n${formatIssues(issues)}`); bad = true; }
if (problems.length) { console.log(`✗ history:\n${formatIssues(problems)}`); bad = true; }
if (!isEmpty(change)) {
  console.log(`✗ the packs changed since the last commit (add ${change.add.length}, move ${change.move.length}, retire ${change.retire.length}, revise ${change.revise.length}). Run: npm run words:commit -- --note "what changed"`);
  bad = true;
}
const lv1 = ALL_WORDS.filter((w) => w.lv === 1 && !w.retired).length;
if (lv1 > 400) console.log(`! ${lv1} words at level 1 — the spec aims for about 300; keep it for the first words a young child meets`);
if (!bad) console.log(`✓ ${ALL_WORDS.length} words in ${PACKS.length} pack(s), history up to date (rev ${snapshot.rev})`);
process.exit(bad ? 1 : 0);
