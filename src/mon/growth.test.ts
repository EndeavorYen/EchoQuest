import { describe, expect, it } from 'vitest';
import { Rng } from '../util/rng';
import { addXp, evolvesTo, stageOf, growthOf, hardChance, isReady, MAX_RANK, takeStep, xpFor, xpNeeded, XP_TO_RANK, type Growths } from './growth';

const fill = (gs: Growths, id: number) => addXp(gs, id, 999);

describe('experience', () => {
  it('perfect is worth more than good, a hard word more again', () => {
    expect(xpFor('good', false)).toBeLessThan(xpFor('perfect', false));
    expect(xpFor('perfect', true)).toBeGreaterThan(xpFor('perfect', false));
  });
  it('the bar stops at full until the step is taken', () => {
    let gs: Growths = {};
    gs = addXp(gs, 4, 10);
    expect(growthOf(gs, 4)).toEqual({ xp: 10, rank: 0, stars: 0 });
    gs = addXp(gs, 4, 999);
    expect(growthOf(gs, 4).xp).toBe(XP_TO_RANK[0]);
    expect(isReady(growthOf(gs, 4))).toBe(true);
  });
  it('a creature nobody has raised starts at nothing', () => {
    expect(growthOf(undefined, 25)).toEqual({ xp: 0, rank: 0, stars: 0 });
  });
});

describe('evolution and stars', () => {
  it('Charmander → Charmeleon → Charizard, then stars until the top rank', () => {
    const rng = new Rng(1);
    let gs: Growths = {};
    let id = 4;
    const seen: string[] = [];
    for (let i = 0; i < MAX_RANK; i++) {
      gs = fill(gs, id);
      const r = takeStep(gs, id, rng)!;
      seen.push(`${r.step.kind}:${r.step.to}`);
      gs = r.gs;
      id = r.step.to;
    }
    expect(seen).toEqual(['evolve:5', 'evolve:6', 'star:6']);
    expect(growthOf(gs, 6)).toEqual({ xp: 0, rank: 3, stars: 1 });
    expect(gs[4]).toBeUndefined();
    expect(gs[5]).toBeUndefined();
    // the top: no more experience counts
    expect(xpNeeded(growthOf(gs, 6))).toBeNull();
    expect(addXp(gs, 6, 50)).toEqual(gs);
    expect(takeStep(fill(gs, 6), 6, rng)).toBeNull();
  });
  it('a legendary (no evolution) gains stars instead', () => {
    const rng = new Rng(2);
    expect(evolvesTo(383)).toEqual([]);
    const r = takeStep(fill({}, 383), 383, rng)!;
    expect(r.step).toMatchObject({ kind: 'star', from: 383, to: 383, rank: 1, stars: 1 });
  });
  it('Eevee picks one of its branches', () => {
    const seen = new Set<number>();
    for (let s = 0; s < 40; s++) seen.add(takeStep(fill({}, 133), 133, new Rng(s))!.step.to);
    expect(seen.size).toBeGreaterThan(2);
    for (const id of seen) expect(evolvesTo(133)).toContain(id);
  });
  it('nothing happens before the bar is full', () => {
    expect(takeStep(addXp({}, 4, 5), 4, new Rng(1))).toBeNull();
  });
  it('evolving into a form someone is already raising keeps the further one', () => {
    const gs: Growths = { 4: { xp: 30, rank: 0, stars: 0 }, 5: { xp: 12, rank: 2, stars: 0 } };
    const r = takeStep(gs, 4, new Rng(1))!;
    expect(r.gs[5]).toEqual({ xp: 12, rank: 2, stars: 0 });
  });
});

describe('hard-card chance', () => {
  it('grows with rank and never passes one in three', () => {
    expect(hardChance(0)).toBe(0);
    expect(hardChance(1)).toBeGreaterThan(0);
    expect(hardChance(2)).toBeGreaterThan(hardChance(1));
    expect(hardChance(3)).toBeCloseTo(1 / 3);
    expect(hardChance(10)).toBeCloseTo(1 / 3);
  });
});

describe('stages', () => {
  it('first form 0, its evolution 1, the one after 2; a lone legend 0', () => {
    expect([4, 5, 6, 383].map((id) => stageOf(id))).toEqual([0, 1, 2, 0]);
  });
});
