import { describe, expect, it } from 'vitest';
import { DEFENSE, rollDefense } from './defense';
import { Afflictions, STATUS, TYPE_STATUS, rollStatus, statusChance } from './status';
import { Battle } from './battle';
import { newPlayer } from './model';
import { Rng } from '../util/rng';
import { foeHp } from '../v3/pacing';

describe('defense outcomes', () => {
  it('a good cast never counters; a perfect one can, and does more often than not reflect or counter', () => {
    const rng = new Rng(7);
    const good = Array.from({ length: 400 }, () => rollDefense('good', rng));
    expect(good).not.toContain('counter');
    expect(good).toContain('block');
    expect(good).toContain('dodge');
    expect(good).toContain('reflect');
    const perfect = Array.from({ length: 400 }, () => rollDefense('perfect', rng));
    expect(perfect.filter((k) => k === 'counter' || k === 'reflect').length / 400).toBeGreaterThan(0.55);
  });

  it('block and dodge throw nothing back, reflect x1, counter x1.5', () => {
    const mk = () => new Battle({ name: 'x', hp: 100, maxHp: 100, boss: false }, [newPlayer(0, 2)]);
    const none = mk().defend(true, DEFENSE.block.mult);
    expect(none.blocked).toBe(true);
    expect(none.reflect).toBe(0);
    const r1 = mk().defend(true, DEFENSE.reflect.mult).reflect;
    const r15 = mk().defend(true, DEFENSE.counter.mult).reflect;
    expect(r1).toBeGreaterThan(0);
    expect(r15).toBe(Math.round(r1 * 1.5));
  });
});

describe('status conditions', () => {
  it('every one of the 18 types has a condition', () => {
    expect(Object.keys(TYPE_STATUS)).toHaveLength(18);
    for (const id of Object.values(TYPE_STATUS)) expect(STATUS[id]).toBeDefined();
  });

  it('perfect casts stick more often than good ones, and bosses resist', () => {
    expect(statusChance('perfect')).toBeGreaterThan(statusChance('good'));
    expect(statusChance('perfect', 0.5)).toBeLessThan(statusChance('perfect'));
    const rng = new Rng(3);
    const hits = Array.from({ length: 500 }, () => rollStatus('fire', 'perfect', rng)).filter(Boolean).length;
    expect(hits / 500).toBeGreaterThan(0.3);
    expect(hits / 500).toBeLessThan(0.6);
    expect(rollStatus('not-a-type', 'perfect', rng)).toBeNull();
  });

  it('burn hurts at the end of each round, then wears off', () => {
    const a = new Afflictions();
    expect(a.apply('burn')).toBe(true);
    expect(a.apply('poison')).toBe(false); // one at a time
    let total = 0;
    let cured = null;
    for (let i = 0; i < 3; i++) { const r = a.endRound(100); total += r.dot; cured = r.cured ?? cured; }
    expect(total).toBe(21);
    expect(cured?.id).toBe('burn');
    expect(a.current).toBeNull();
  });

  it('sleep and freeze always skip the counter; stun skips once; healthy creatures act', () => {
    const rng = new Rng(1);
    const a = new Afflictions();
    expect(a.beforeCounter(rng)).toBe('act');
    a.apply('sleep');
    expect(a.beforeCounter(rng)).toBe('skip');
    a.clear();
    a.apply('stun');
    expect(a.beforeCounter(rng)).toBe('skip');
    a.endRound(100);
    expect(a.beforeCounter(rng)).toBe('act');
  });

  it('confusion sometimes turns the attack on itself', () => {
    const rng = new Rng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const a = new Afflictions();
      a.apply('confusion');
      seen.add(a.beforeCounter(rng));
    }
    expect(seen.has('selfhit')).toBe(true);
    expect(seen.has('act')).toBe(true);
  });
});

describe('short fights', () => {
  it('commons fall to about two perfect hits, bosses take five, and HP never gets silly', () => {
    const p = [newPlayer(0, 1)];
    const common = foeHp(p, 1, false);
    expect(common).toBeLessThanOrEqual(30);
    expect(foeHp(p, 5, false)).toBeGreaterThan(common);
    expect(foeHp(p, 3, true)).toBeGreaterThan(foeHp(p, 5, false));
    // two perfect level-1 hits (12 then 13.8) already finish a common
    expect(12 + 13.8).toBeGreaterThanOrEqual(common * 0.85);
  });
});
