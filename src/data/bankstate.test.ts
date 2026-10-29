import { describe, expect, it } from 'vitest';
import { ALL_WORDS, PACKS, buildBank, type Pack } from './bank';
import { validatePack, validateLinks } from './validate';
import { diffBank, snapshotOf } from './bankdiff';
import { LEDGER, BANK_REV } from './ledger';
import snapshot from './bankstate/snapshot.json';
import { reconcile, mergeProgress } from '../game/reconcile';
import { defaultSave, load, persist } from '../game/save';
import type { LedgerRev } from './ledger';

const pk = (words: Pack['words']): Pack => ({ id: 't', name: 't', license: 'test', lists: ['t'], words });
const rules = (words: Pack['words'], strict = true) => validatePack(pk(words), { strict }).map((i) => i.rule);

describe('shipped word bank', () => {
  it('every pack passes the spec', () => {
    for (const p of PACKS) expect(validatePack(p, { strict: p.id !== 'starter' }), p.id).toEqual([]);
    expect(validateLinks(PACKS)).toEqual([]);
  });

  it('the committed history matches the packs: run "npm run words:commit" after editing a pack', () => {
    const { change, problems } = diffBank(snapshot, ALL_WORDS);
    expect(problems).toEqual([]);
    expect(change).toEqual({ add: [], move: [], retire: [], revise: [] });
    expect(snapshot.rev).toBe(BANK_REV);
    expect(LEDGER.map((r) => r.rev)).toEqual(LEDGER.map((_, i) => i + 1));
  });
});

describe('pack validator', () => {
  const ok = { w: 'cat', pos: 'n' as const, zh: '貓', lv: 1 as const, topic: 'animal' };
  it('accepts a good word, with or without a picture', () => {
    expect(rules([ok])).toEqual([]);
    expect(rules([{ ...ok, w: 'under', pos: 'prep', zh: '在…下面' }])).toEqual([]);
  });
  it('rejects Simplified Chinese, pinyin, English in zh, unknown topic, wrong CEFR level, bad emoji', () => {
    expect(rules([{ ...ok, zh: '猫' }])).toContain('zh');
    expect(rules([{ ...ok, zh: 'māo' }])).toContain('zh');
    expect(rules([{ ...ok, zh: 'a cat' }])).toContain('zh');
    expect(rules([{ ...ok, topic: 'nope' }])).toContain('topic');
    expect(rules([{ ...ok, cefr: 'B2' }])).toContain('cefr-lv');
    expect(rules([{ ...ok, icon: 'cat' }])).toContain('icon');
  });
  it('rejects bad words, duplicates and a heard list that repeats the word', () => {
    expect(rules([{ ...ok, w: 'Cat' }])).toContain('word');
    expect(rules([ok, ok])).toContain('duplicate');
    expect(rules([{ ...ok, heard: ['cat'] }])).toContain('heard');
  });
  it('replacedBy must point at a real word and must not loop', () => {
    const a = { ...ok, w: 'a1', retired: true, replacedBy: 'b1:n' };
    const b = { ...ok, w: 'b1' };
    expect(validateLinks([pk([a])]).map((i) => i.rule)).toContain('replacedBy');
    expect(validateLinks([pk([a, b])])).toEqual([]);
    expect(validateLinks([pk([a, { ...b, retired: true, replacedBy: 'a1:n' }])]).length).toBeGreaterThan(0);
  });
});

describe('change tracking', () => {
  const base = buildBank([pk([{ w: 'cat', pos: 'n', zh: '貓', lv: 1 }, { w: 'dog', pos: 'n', zh: '狗', lv: 1 }])]);
  const snap = snapshotOf(1, base);
  it('sees additions, revisions, moves and retirements', () => {
    const next = buildBank([pk([
      { w: 'cat', pos: 'n', zh: '貓咪', lv: 1 },
      { w: 'dog', pos: 'n', zh: '狗', lv: 1, retired: true, replacedBy: 'hound:n' },
      { w: 'hound', pos: 'n', zh: '獵犬', lv: 2 },
    ])]);
    const { change, problems } = diffBank(snap, next);
    expect(problems).toEqual([]);
    expect(change).toEqual({ add: ['hound:n'], move: [['dog:n', 'hound:n']], retire: [], revise: ['cat:n'] });
  });
  it('refuses to forget a word that was deleted', () => {
    const { problems } = diffBank(snap, buildBank([pk([{ w: 'cat', pos: 'n', zh: '貓', lv: 1 }])]));
    expect(problems.map((p) => p.rule)).toEqual(['deleted']);
  });
  it('retired words are known but not dealt', () => {
    const bank = buildBank([pk([{ w: 'cat', pos: 'n', zh: '貓', lv: 1, retired: true }])]);
    expect(bank[0].retired).toBe(true);
  });
});

describe('reconcile: saves follow the word bank', () => {
  const wp = (mastery: 0 | 1 | 2 | 3, attempts = 1) => ({ attempts, correct: attempts, misses: 0, streak: mastery, mastery, lastAt: 5, dueAt: 9 });
  const rev = (n: number, move: [string, string][] = [], retire: string[] = []): LedgerRev => ({ rev: n, date: 'd', note: '', add: [], move, retire, revise: [] });
  const withProgress = (rev0: number | undefined) => {
    const s = defaultSave();
    s.bankRev = rev0;
    s.players[0].progress = { 'dog:n': wp(2, 4), 'cat:n': wp(1) };
    s.collection = ['dog:n', 'cat:n'];
    s.aliases = { 'dog:n': ['dawg'] };
    return s;
  };

  it('moves progress, collection and learned aliases when a word is renamed', () => {
    const out = reconcile(withProgress(1), [rev(1), rev(2, [['dog:n', 'hound:n']])], 2);
    expect(out.players[0].progress['hound:n']).toEqual(wp(2, 4));
    expect('dog:n' in out.players[0].progress).toBe(false);
    expect(out.collection).toEqual(['cat:n', 'hound:n']);
    expect(out.aliases).toEqual({ 'hound:n': ['dawg'] });
    expect(out.bankRev).toBe(2);
  });
  it('merging two words keeps the better mastery and adds up the history', () => {
    const s = withProgress(1);
    s.players[0].progress['hound:n'] = wp(3, 2);
    const out = reconcile(s, [rev(2, [['dog:n', 'hound:n']])], 2);
    expect(out.players[0].progress['hound:n']).toMatchObject({ attempts: 6, mastery: 3 });
    expect(mergeProgress(wp(1), wp(2)).mastery).toBe(2);
  });
  it('follows chains across revisions, and is idempotent', () => {
    const ledger = [rev(2, [['dog:n', 'hound:n']]), rev(3, [['hound:n', 'wolf:n']])];
    const once = reconcile(withProgress(1), ledger, 3);
    expect(once.players[0].progress['wolf:n']).toBeDefined();
    expect(reconcile(once, ledger, 3)).toBe(once);
  });
  it('does not downgrade a save from a newer build, and keeps retired words\' progress', () => {
    const newer = withProgress(5);
    expect(reconcile(newer, [rev(2, [['dog:n', 'hound:n']])], 2)).toBe(newer);
    const out = reconcile(withProgress(1), [rev(2, [], ['cat:n'])], 2);
    expect(out.players[0].progress['cat:n']).toEqual(wp(1)); // kept, just ignored
    expect(out.collection).toContain('cat:n');
  });
  it('load() brings an old save up to date and persists it; unknown ids are left alone', () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const old = withProgress(undefined);
    old.players[0].progress['zzz:n'] = wp(1);
    persist(old, s);
    const back = load(s);
    expect(back.bankRev).toBe(BANK_REV);
    expect(back.players[0].progress['zzz:n']).toBeDefined();
    expect(JSON.parse(mem.get('echoquest.v3')!).bankRev).toBe(BANK_REV);
  });
});
