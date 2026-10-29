import { describe, expect, it } from 'vitest';
import { arrive, begin, checkTrail, generateTrail, isDone, isTrail, midRows, options, stay } from './trail';

describe('trek map generation', () => {
  it('every generated map obeys the rules, for many seeds and map sizes', () => {
    for (let region = 1; region <= 12; region++) {
      for (let seed = 1; seed <= 300; seed++) {
        const t = generateTrail(seed * 7919 + region, region);
        expect(checkTrail(t), `seed ${seed} region ${region}`).toEqual([]);
      }
    }
  });

  it('is deterministic per seed, different between seeds, and grows with each map', () => {
    expect(generateTrail(5, 2)).toEqual(generateTrail(5, 2));
    const shapes = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(generateTrail(i + 1).stops.map((s) => [s.kind, s.next]))));
    expect(shapes.size).toBeGreaterThan(30);
    expect(midRows(1)).toBeLessThan(midRows(4));
    expect(midRows(99)).toBe(10);
    const rows = (r: number) => Math.max(...generateTrail(1, r).stops.map((s) => s.row)) + 1;
    expect(rows(1)).toBeLessThan(rows(5));
  });

  it('really branches: some stops give a choice and some are reachable from several stops', () => {
    let choice = 0, merge = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const t = generateTrail(seed);
      if (t.stops.some((s) => s.next.length > 1)) choice++;
      if (t.stops.some((s) => t.stops.filter((p) => p.next.includes(s.id)).length > 1)) merge++;
    }
    expect(choice).toBe(50);
    expect(merge).toBeGreaterThan(40);
  });

  it('the checker catches broken maps', () => {
    const t = generateTrail(3);
    const deadEnd = { ...t, stops: t.stops.map((s) => (s.row === 2 ? { ...s, next: [] } : s)) };
    expect(checkTrail(deadEnd).join()).toMatch(/dead end/);
    const chests = { ...t, stops: t.stops.map((s) => (s.row === 1 ? { ...s, kind: 'chest' as const } : s)) };
    expect(checkTrail(chests).join()).toMatch(/first row|two chests/);
  });
});

describe('walking the trail', () => {
  it('only neighbours can be played; winning moves the party, losing or fleeing does not', () => {
    let t = generateTrail(11);
    expect(t.at).toBe(0);
    const far = t.stops.find((s) => s.row === 3)!;
    expect(begin(t, far.id).target).toBeNull();
    const [first] = options(t);
    t = begin(t, first.id);
    expect(t.target).toBe(first.id);
    const fled = stay(t);
    expect(fled.at).toBe(0);
    expect(fled.target).toBeNull();
    expect(fled.cleared).toEqual([0]);
    const won = arrive(t, first.id);
    expect(won.at).toBe(first.id);
    expect(won.cleared).toEqual([0, first.id]);
    expect(options(won).every((s) => s.row === first.row + 1)).toBe(true);
  });

  it('a whole trek can be walked to the boss', () => {
    let t = generateTrail(2);
    let guard = 0;
    while (!isDone(t) && guard++ < 50) {
      const o = options(t);
      t = arrive(t, o[guard % o.length].id);
    }
    expect(isDone(t)).toBe(true);
    expect(t.stops[t.at].kind).toBe('boss');
  });

  it('isTrail refuses old or broken saves', () => {
    expect(isTrail(generateTrail(1))).toBe(true);
    expect(isTrail({ seed: 1, nodes: [], idx: 0 })).toBe(false);
    expect(isTrail(null)).toBe(false);
  });
});
