import { describe, expect, it } from 'vitest';
import { DEX } from './dex';
import { gradeOf, heartsFor, shieldLayersFor } from './rarity';

describe('rarity grades', () => {
  it('1–3★ common, 4★ rare, 5★ legend', () => {
    expect([1, 2, 3, 4, 5].map(gradeOf)).toEqual(['common', 'common', 'common', 'rare', 'legend']);
  });
  it('every 4★ and 5★ carries a shield even when it is just a wild creature', () => {
    for (const m of DEX) {
      const layers = shieldLayersFor(m.rarity, false);
      if (m.rarity >= 5) expect(layers, m.name).toBe(3);
      else if (m.rarity === 4) expect(layers, m.name).toBe(2);
      else expect(layers, m.name).toBe(0);
    }
  });
  it('bosses keep their shield, as before', () => {
    expect(shieldLayersFor(2, true)).toBe(2);
    expect(shieldLayersFor(3, true)).toBe(2);
    expect(shieldLayersFor(4, true)).toBe(3);
    expect(shieldLayersFor(5, true)).toBe(3);
  });
  it('rare fights give one more heart than ordinary ones; bosses seven', () => {
    expect(heartsFor(2, false)).toBe(5);
    expect(heartsFor(4, false)).toBe(6);
    expect(heartsFor(5, false)).toBe(6);
    expect(heartsFor(5, true)).toBe(7);
  });
});
