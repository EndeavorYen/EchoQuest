import { describe, expect, it } from 'vitest';
import { DEX, MON_BY_ID, TYPES, buildDex, pickWild, shieldLayers, starterFor, artUrl, backSpriteUrl, typeOf } from './dex';
import { Rng } from '../util/rng';

describe('creature roster (imported from colormon)', () => {
  it('has every creature once, with a known type and 1–5 stars', () => {
    expect(DEX.length).toBe(1025);
    expect(new Set(DEX.map((m) => m.id)).size).toBe(DEX.length);
    for (const m of DEX) {
      expect(TYPES[m.type], `${m.id} ${m.type}`).toBeTruthy();
      expect(m.rarity).toBeGreaterThanOrEqual(1);
      expect(m.rarity).toBeLessThanOrEqual(5);
      expect(m.colors.length).toBeGreaterThan(0);
    }
  });

  it('applies the hand-picked colour tweaks over the generation data', () => {
    expect(MON_BY_ID.get(1)!.colors).toEqual(['#78C8A8', '#4FA048']);
    expect(MON_BY_ID.get(1)!.name).toBeTruthy();
  });

  it('merges partial entries into full ones and ignores incomplete new ones', () => {
    const dex = buildDex([
      { pokemon: [{ id: 1, name: 'a', type: 'fire', rarity: 2, colors: ['#fff'] }, { id: 2 }] },
      { pokemon: [{ id: 1, colors: ['#000'] }] },
    ]);
    expect(dex).toEqual([{ id: 1, name: 'a', type: 'fire', rarity: 2, colors: ['#000'] }]);
  });

  it('builds image links without storing any image', () => {
    expect(artUrl(25)).toContain('official-artwork/25.png');
    expect(backSpriteUrl(25)).toContain('/back/25.png');
  });

  it('three stars and up carry shield layers, fewer do not', () => {
    const by = (r: number) => DEX.find((m) => m.rarity === r)!;
    expect(shieldLayers(by(1))).toBe(0);
    expect(shieldLayers(by(2))).toBe(0);
    expect(shieldLayers(by(3))).toBe(3);
    expect(shieldLayers(by(5))).toBe(5);
  });

  it('wild picks favour common creatures and can be capped', () => {
    const rng = new Rng(7);
    const rar = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) rar[pickWild(rng).rarity] += 1;
    expect(rar[1]).toBeGreaterThan(rar[3]);
    expect(rar[3]).toBeGreaterThan(rar[5]);
    for (let i = 0; i < 200; i++) expect(pickWild(rng, { maxRarity: 2 }).rarity).toBeLessThanOrEqual(2);
  });

  it('starters exist and have a type look', () => {
    for (let i = 0; i < 8; i++) {
      const m = starterFor(i);
      expect(m).toBeTruthy();
      expect(typeOf(m).color).toMatch(/^#/);
    }
  });
});
