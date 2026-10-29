import { describe, expect, it } from 'vitest';
import { EVO, evoTree, paginate, type EvoMap } from './evolve';
import { DEX } from './dex';

const ids = (t: ReturnType<typeof evoTree>): number[] => (t ? [t.id, ...t.kids.flatMap((k) => ids(k))] : []);

describe('evoTree', () => {
  it('gives the same family from any stage', () => {
    for (const id of [1, 2, 3]) expect(ids(evoTree(id))).toEqual([1, 2, 3]);
  });
  it('keeps every branch of a branching family', () => {
    const eevee = evoTree(133)!;
    expect(eevee.id).toBe(133);
    expect(eevee.kids.map((k) => k.id)).toEqual(EVO['133'].to);
    expect(eevee.kids.length).toBeGreaterThan(3);
    expect(ids(evoTree(135))).toEqual(ids(eevee));
  });
  it('is null for a creature with no relatives', () => {
    const lone = DEX.find((m) => !EVO[String(m.id)]);
    expect(lone).toBeTruthy();
    expect(evoTree(lone!.id)).toBeNull();
  });
  it('survives a loop in bad data', () => {
    const loop: EvoMap = { '1': { from: 2, to: [2] }, '2': { from: 1, to: [1] } };
    expect(ids(evoTree(1, loop)).length).toBeLessThanOrEqual(2);
  });
  it('every family in the data builds and reaches only known creatures', () => {
    const known = new Set(DEX.map((m) => m.id));
    for (const key of Object.keys(EVO)) {
      const t = evoTree(Number(key));
      for (const id of ids(t)) expect(known.has(id)).toBe(true);
    }
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 30 }, (_, i) => i);
  it('cuts pages and counts them', () => {
    expect(paginate(list, 0, 12)).toMatchObject({ items: list.slice(0, 12), page: 0, pages: 3 });
    expect(paginate(list, 2, 12).items).toHaveLength(6);
  });
  it('keeps the page in range', () => {
    expect(paginate(list, 9, 12).page).toBe(2);
    expect(paginate(list, -3, 12).page).toBe(0);
  });
  it('has one empty page for an empty list', () => {
    expect(paginate([], 0, 12)).toEqual({ items: [], page: 0, pages: 1 });
  });
});
