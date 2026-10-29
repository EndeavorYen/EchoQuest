/**
 * The rules every word-bank pack must pass (spec: docs/word-bank-spec.md).
 * Used by `npm run words:merge`, `npm run words:check` and the unit tests, so a pack an
 * agent wrote is checked the same way before it can ship.
 */
import { Converter } from 'opencc-js';
import { LEVELS, POS_LIST, TOPIC_BY_ID, wordId, type Pack, type PackWord } from './bank';

export interface Issue {
  /** `w:pos` of the word, or the pack id for pack-level problems */
  where: string;
  rule: string;
  msg: string;
}

/** CEFR band → the game levels it may be placed in. */
export const CEFR_TO_LV: Record<string, number[]> = { A1: [1, 2], A2: [2], B1: [3], B2: [4], C1: [4] };

const toTaiwan = Converter({ from: 'cn', to: 'tw' });
const LATIN = /[A-Za-z]/;
const PINYIN_TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
const WORD_RE = /^[a-z][a-z .'\-]*[a-z.]$|^[a-z]$/;
// a word with no picture is fine: the game shows the Chinese meaning and says English, then Chinese
const EMOJI_BAD = /[A-Za-z0-9]/;

function packWordIssues(e: PackWord, strict: boolean): Issue[] {
  const where = `${(e.w ?? '').toString().trim().toLowerCase()}:${e.pos}`;
  const out: Issue[] = [];
  const bad = (rule: string, msg: string) => out.push({ where, rule, msg });
  if (typeof e.w !== 'string' || !WORD_RE.test(e.w.trim().toLowerCase())) bad('word', `"${e.w}" is not a lowercase English word or phrase`);
  else if (e.w !== e.w.trim().toLowerCase()) bad('word', 'use lowercase without surrounding spaces');
  if (!POS_LIST.includes(e.pos)) bad('pos', `pos "${e.pos}" must be one of ${POS_LIST.join(', ')}`);
  if (!LEVELS.some((l) => l.lv === e.lv)) bad('lv', `lv ${e.lv} is not a defined level`);
  if (typeof e.zh !== 'string' || !e.zh.trim()) bad('zh', 'zh is empty');
  else {
    if (e.zh.length > 14) bad('zh', 'zh too long (max 14 chars): give the short everyday meaning, not a definition');
    if (LATIN.test(e.zh) && !/^[A-Za-z]{1,3}$/.test(e.zh)) bad('zh', 'zh must be Chinese only (no English or pinyin)');
    if (PINYIN_TONE.test(e.zh)) bad('zh', 'zh contains pinyin');
    const tw = toTaiwan(e.zh);
    if (tw !== e.zh) bad('zh', `zh looks Simplified or non-Taiwan wording ("${e.zh}" → "${tw}"); use Traditional Chinese as used in Taiwan`);
  }
  if (e.topic !== undefined && !TOPIC_BY_ID.has(e.topic)) bad('topic', `topic "${e.topic}" is not in topics.json`);
  if (strict && !e.topic && !e.retired) bad('topic', 'topic is required');
  if (e.cefr !== undefined) {
    if (!(e.cefr in CEFR_TO_LV)) bad('cefr', `cefr "${e.cefr}" must be A1, A2, B1, B2 or C1`);
    else if (!CEFR_TO_LV[e.cefr].includes(e.lv)) bad('cefr-lv', `cefr ${e.cefr} may only be level ${CEFR_TO_LV[e.cefr].join(' or ')}, not ${e.lv}`);
  }
  if (e.icon !== undefined && (!e.icon || EMOJI_BAD.test(e.icon) || [...e.icon].length > 4)) bad('icon', 'icon must be one emoji');
  if (e.heard) {
    if (!Array.isArray(e.heard) || e.heard.length > 12) bad('heard', 'heard is a list of at most 12 transcripts');
    else for (const h of e.heard) if (typeof h !== 'string' || h !== h.toLowerCase() || h === e.w || !h.trim()) bad('heard', `heard "${h}" must be a lowercase transcript different from the word`);
  }
  if (e.retired && e.replacedBy !== undefined && (e.replacedBy === where || !/^.+:[a-z]+$/.test(e.replacedBy))) bad('replacedBy', 'replacedBy must be another word id like "bank:n"');
  if (e.replacedBy && !e.retired) bad('replacedBy', 'replacedBy only makes sense on a retired word');
  return out;
}

export function validatePack(pack: Pack, opts: { strict?: boolean } = {}): Issue[] {
  const out: Issue[] = [];
  const p = (rule: string, msg: string) => out.push({ where: pack.id ?? '?', rule, msg });
  if (!pack.id || !/^[a-z0-9-]+$/.test(pack.id)) p('pack', 'pack id must be lowercase letters, digits or -');
  if (!pack.name) p('pack', 'pack needs a name');
  if (!pack.license) p('pack', 'pack needs a license / source statement');
  if (!Array.isArray(pack.lists) || !pack.lists.length) p('pack', 'pack needs at least one list id');
  const seen = new Set<string>();
  for (const e of pack.words ?? []) {
    out.push(...packWordIssues(e, opts.strict ?? false));
    const id = wordId(e.w ?? '', e.pos);
    if (seen.has(id)) out.push({ where: id, rule: 'duplicate', msg: 'listed twice in the same pack' });
    seen.add(id);
  }
  return out;
}

/** Cross-pack checks: replacements must point at real, living words. */
export function validateLinks(packs: Pack[]): Issue[] {
  const all = new Map<string, PackWord>();
  for (const pk of packs) for (const e of pk.words) all.set(wordId(e.w, e.pos), e);
  const out: Issue[] = [];
  for (const [id, e] of all) {
    if (!e.retired || !e.replacedBy) continue;
    const t = all.get(e.replacedBy);
    if (!t) out.push({ where: id, rule: 'replacedBy', msg: `replacement ${e.replacedBy} does not exist` });
    else if (e.replacedBy === id) out.push({ where: id, rule: 'replacedBy', msg: 'replaces itself' });
  }
  // a chain a→b→a would make reconcile loop forever in spirit; refuse cycles
  for (const [id] of all) {
    const seen = new Set<string>([id]);
    let cur = all.get(id);
    while (cur?.retired && cur.replacedBy) {
      if (seen.has(cur.replacedBy)) { out.push({ where: id, rule: 'replacedBy', msg: 'replacement chain loops' }); break; }
      seen.add(cur.replacedBy);
      cur = all.get(cur.replacedBy);
    }
  }
  return out;
}

export const formatIssues = (issues: Issue[]): string => issues.map((i) => `  [${i.rule}] ${i.where}: ${i.msg}`).join('\n');
