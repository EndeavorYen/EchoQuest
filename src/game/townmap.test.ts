import { describe, expect, it } from 'vitest';
import { Rng } from '../util/rng';
import { DEX, TYPES } from '../mon/dex';
import {
  checkTownMap, fewestFights, generateTownMap, isTownMap, neighbors, startEntering, moveTo, winEntering, retreat, useInfo, takeGift, canGift,
  needsFight, rollRarity, RARITY_TABLE, TYPE_IDS, isRevealed, type MapSize, type TownMap,
} from './townmap';

const seeds = Array.from({ length: 120 }, (_, i) => i * 7919 + 13);
const SIZES: MapSize[] = ['S', 'M', 'L'];

describe('generated maps', () => {
  it('obey every rule, for every size and many seeds', () => {
    for (const size of SIZES) for (const seed of seeds) {
      expect(checkTownMap(generateTownMap(seed, size)), `seed ${seed} size ${size}`).toEqual([]);
    }
  });
  it('are the same for the same seed and differ otherwise', () => {
    expect(generateTownMap(5)).toEqual(generateTownMap(5));
    expect(generateTownMap(5)).not.toEqual(generateTownMap(6));
  });
  it('come in three sizes by chance, about 35 / 45 / 20 %', () => {
    const n: Record<string, number> = { S: 0, M: 0, L: 0 };
    for (const s of seeds) n[generateTownMap(s).size]++;
    expect(n.S / seeds.length).toBeGreaterThan(0.27);
    expect(n.S / seeds.length).toBeLessThan(0.43);
    expect(n.M / seeds.length).toBeGreaterThan(0.37);
    expect(n.L / seeds.length).toBeGreaterThan(0.13);
    expect(n.L / seeds.length).toBeLessThan(0.27);
  });
  it('do not keep growing: a map is as big as its size says, and bigger sizes are bigger', () => {
    const rows = Object.fromEntries(SIZES.map((z) => [z, seeds.slice(0, 40).map((s) => generateTownMap(s, z))])) as Record<MapSize, TownMap[]>;
    const avg = (z: MapSize, f: (m: TownMap) => number): number => rows[z].reduce((a, m) => a + f(m), 0) / rows[z].length;
    for (const f of [(m: TownMap) => m.nodes.length, (m: TownMap) => fewestFights(m)]) {
      expect(avg('S', f)).toBeLessThan(avg('M', f));
      expect(avg('M', f)).toBeLessThan(avg('L', f));
    }
    for (const m of rows.S) {
      expect(m.nodes.filter((n) => n.kind !== 'wild').length).toBeLessThanOrEqual(12);
      expect(fewestFights(m)).toBeGreaterThanOrEqual(3);
      expect(fewestFights(m)).toBeLessThanOrEqual(16);
    }
    for (const m of rows.L) {
      expect(m.nodes.filter((n) => n.kind !== 'wild').length).toBeGreaterThanOrEqual(13);
      expect(fewestFights(m)).toBeLessThanOrEqual(40);
    }
  });
  it('have forks: more than one way through, and towns to rest in', () => {
    for (const seed of seeds.slice(0, 100)) {
      const m = generateTownMap(seed, 'M');
      expect(m.nodes.filter((n) => n.kind === 'town').length).toBeGreaterThanOrEqual(2);
    }
  });
  it('are drawn on a grid: roads go only north, south, east or west', () => {
    for (const seed of seeds.slice(0, 40)) for (const r of generateTownMap(seed, 'L').roads) {
      r.path.forEach(([c, row], i) => { if (i) expect(Math.abs(c - r.path[i - 1][0]) + Math.abs(row - r.path[i - 1][1])).toBe(1); });
    }
  });
  it('use real types, and every type turns up across a few maps', () => {
    for (const t of TYPE_IDS) expect(TYPES[t], t).toBeTruthy();
    const seen = new Set<string>();
    for (const seed of seeds.slice(0, 40)) for (const n of generateTownMap(seed).nodes) n.types.forEach((t) => seen.add(t));
    expect([...seen].sort()).toEqual([...TYPE_IDS].sort());
  });
  it('are accepted by the save check, and junk is not', () => {
    expect(isTownMap(generateTownMap(3))).toBe(true);
    expect(isTownMap({})).toBe(false);
    expect(isTownMap(null)).toBe(false);
    expect(isTownMap({ ...generateTownMap(3), v: 1 })).toBe(false);
  });
});

describe('rarity', () => {
  const freq = (cat: 'small' | 'big' | 'gym' | 'final', progress: number): number[] => {
    const rng = new Rng(7);
    const n = [0, 0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) n[rollRarity(rng, cat, progress) - 1]++;
    return n.map((x) => x / 20000);
  };
  it('tables add up to 100%', () => {
    for (const row of Object.values(RARITY_TABLE)) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
  it('small stops are mostly common, with only a sliver of 4-star or better', () => {
    const f = freq('small', 0);
    expect(f[0]).toBeGreaterThan(0.35);
    expect(f[3] + f[4]).toBeLessThan(0.02);
    expect(f[3]).toBeGreaterThan(0);
    expect(f[4]).toBe(0);
  });
  it('big places lean to 3 stars and up to 5 stars; gym bosses are 3-4; the last boss is 4-5', () => {
    const b = freq('big', 0);
    expect(b[0]).toBe(0);
    expect(b[2]).toBeGreaterThan(0.4);
    expect(b[3] + b[4]).toBeGreaterThan(0.15);
    const g = freq('gym', 0.5);
    expect(g[0] + g[1] + g[4]).toBe(0);
    const f = freq('final', 1);
    expect(f[0] + f[1] + f[2]).toBe(0);
    expect(f[3]).toBeGreaterThan(0.5);
    expect(f[4]).toBeGreaterThan(0.2);
  });
  it('the further up the map, the rarer', () => {
    expect(freq('small', 1)[0]).toBeLessThan(freq('small', 0)[0]);
    expect(freq('small', 1)[2]).toBeGreaterThan(freq('small', 0)[2]);
  });
  it('the dex has creatures at every rarity', () => {
    for (let r = 1; r <= 5; r++) expect(DEX.some((m) => m.rarity === r), `rarity ${r}`).toBe(true);
  });
});

describe('walking', () => {
  const m0 = (): TownMap => generateTownMap(42, 'M');
  const firstFight = (m: TownMap): number => neighbors(m, m.at).find((n) => needsFight(m, n))!;
  it('only a neighbour can be stepped onto', () => {
    const m = m0();
    const far = m.nodes.find((n) => !neighbors(m, m.at).includes(n.id) && n.id !== m.at)!;
    expect(startEntering(m, far.id)).toBe(m);
    const near = firstFight(m);
    expect(startEntering(m, near).entering).toBe(near);
  });
  it('a win is kept; backing out, losing or running away changes nothing else', () => {
    const m = m0();
    const near = firstFight(m);
    const going = startEntering(m, near);
    const back = retreat(going);
    expect(back).toEqual(m);
    const won = winEntering(going);
    expect(won.at).toBe(near);
    expect(won.cleared).toEqual([near]);
    expect(won.entering).toBeNull();
    // beaten places have nothing to fight any more: walk back and forth freely
    expect(needsFight(won, near)).toBe(false);
    const home = moveTo(won, 0);
    expect(home.at).toBe(0);
    expect(moveTo(home, near).at).toBe(near);
  });
  it('towns have no creature and can be walked into', () => {
    let m = m0();
    // walk along the road to the first big place
    for (let i = 0; i < 400 && m.nodes[m.at].kind !== 'town' || m.at === 0; i++) {
      const next = neighbors(m, m.at).filter((n) => m.nodes[n].layer >= m.nodes[m.at].layer && !m.visited.includes(n))[0] ?? neighbors(m, m.at)[0];
      m = needsFight(m, next) ? winEntering(startEntering(m, next)) : moveTo(m, next);
      if (m.nodes[m.at].kind === 'town' && m.at !== 0) break;
    }
    expect(m.nodes[m.at].kind).toBe('town');
  });
  it('a town gives its news once, showing the types of the places around it', () => {
    const m = m0();
    expect(isRevealed(m, 5)).toBe(false);
    const n = useInfo(m);
    expect(n.infoDone).toEqual([0]);
    expect(n.revealed.length).toBeGreaterThan(3);
    expect(neighbors(m, 0).every((x) => isRevealed(n, x))).toBe(true);
    expect(useInfo(n)).toBe(n);
  });
  it('a gift can be taken only once', () => {
    const base = m0();
    const t = base.nodes.find((x) => x.kind === 'town' && x.gift)!;
    let m: TownMap = { ...base, at: t.id };
    expect(canGift(m)).toBe(true);
    m = takeGift(m);
    expect(canGift(m)).toBe(false);
    expect(takeGift(m).gifts).toEqual(m.gifts);
  });
});
