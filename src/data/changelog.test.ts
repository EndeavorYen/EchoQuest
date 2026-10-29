import { describe, expect, it } from 'vitest';
import { CHANGELOG, LATEST, unseen } from './changelog';

describe('changelog', () => {
  it('is newest first with unique versions and short plain lines', () => {
    expect(new Set(CHANGELOG.map((r) => r.version)).size).toBe(CHANGELOG.length);
    expect(LATEST).toBe(CHANGELOG[0].version);
    for (const r of CHANGELOG) {
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items.length).toBeLessThanOrEqual(6);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const line of r.items) expect(line.length).toBeLessThanOrEqual(60);
    }
    const dates = CHANGELOG.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it('knows what is new since the last look', () => {
    expect(unseen(null).map((r) => r.version)).toEqual([LATEST]); // a first visit highlights only the newest
    expect(unseen(LATEST)).toEqual([]);
    expect(unseen(CHANGELOG[CHANGELOG.length - 1].version)).toHaveLength(CHANGELOG.length - 1);
  });
});
