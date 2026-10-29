import { describe, expect, it } from 'vitest';
import { analyzeColors, colorWord, isNight, pickMon, rgbLab, solidPixels } from './colorpick';
import { Rng } from '../util/rng';
import { MON_BY_ID } from './dex';

const N = 32;

function scene(bg: [number, number, number], blob: [number, number, number] | null): Uint8ClampedArray {
  const px = solidPixels(bg, N);
  if (!blob) return px;
  for (let y = 10; y < 22; y++) for (let x = 10; x < 22; x++) {
    const i = (y * N + x) * 4;
    px[i] = blob[0]; px[i + 1] = blob[1]; px[i + 2] = blob[2];
  }
  return px;
}

describe('colour picking (ported from colormon)', () => {
  it('converts colours to Lab sensibly', () => {
    expect(rgbLab(255, 255, 255)[0]).toBeGreaterThan(99);
    expect(rgbLab(0, 0, 0)[0]).toBeLessThan(1);
    expect(rgbLab(255, 0, 0)[1]).toBeGreaterThan(60);
  });

  it('names colours in English for the little ones', () => {
    expect(colorWord([230, 30, 30]).en).toBe('red');
    expect(colorWord([30, 90, 220]).en).toBe('blue');
    expect(colorWord([250, 250, 250]).en).toBe('white');
    expect(colorWord([5, 5, 5]).en).toBe('black');
  });

  it('finds a small red toy on a grey floor as the subject', () => {
    const a = analyzeColors(scene([150, 150, 150], [220, 30, 30]), N);
    expect(a.mask).not.toBeNull();
    expect(a.pal[0].subject).toBe(true);
    expect(a.pal[0].word.en).toBe('red');
  });

  it('a mostly red picture brings mostly warm-coloured creatures', () => {
    const pal = analyzeColors(scene([200, 40, 40], null), N).pal;
    const runs = 60;
    const picks = Array.from({ length: runs }, (_, s) => pickMon(pal, new Rng(s + 1)).mon);
    const fire = picks.filter((m) => m.type === 'fire').length;
    expect(fire / runs).toBeGreaterThan(0.2);
    const water = picks.filter((m) => m.type === 'water').length;
    expect(water).toBeLessThan(fire);
  });

  it('a blue picture leans to water or ice rather than fire', () => {
    const pal = analyzeColors(scene([30, 90, 220], null), N).pal;
    const picks = Array.from({ length: 60 }, (_, s) => pickMon(pal, new Rng(s + 1)).mon);
    const cool = picks.filter((m) => m.type === 'water' || m.type === 'ice' || m.type === 'flying' || m.type === 'psychic').length;
    const fire = picks.filter((m) => m.type === 'fire').length;
    expect(cool).toBeGreaterThan(fire);
  });

  it('a dark room is night: ghosts, darkness and night creatures', () => {
    const pal = analyzeColors(solidPixels([6, 6, 10], N), N).pal;
    expect(isNight(pal)).toBe(true);
    const r = pickMon(pal, new Rng(3));
    expect(r.night).toBe(true);
  });

  it('boss stops can ask for rare creatures only', () => {
    const pal = analyzeColors(scene([200, 40, 40], null), N).pal;
    for (let s = 1; s <= 20; s++) expect(pickMon(pal, new Rng(s), { minRarity: 3 }).mon.rarity).toBeGreaterThanOrEqual(3);
  });

  it('creatures already caught turn up a bit less', () => {
    const pal = analyzeColors(scene([200, 40, 40], null), N).pal;
    const base = Array.from({ length: 200 }, (_, s) => pickMon(pal, new Rng(s + 1)).mon.id);
    const top = [...new Set(base)].sort((a, b) => base.filter((x) => x === b).length - base.filter((x) => x === a).length)[0];
    const again = Array.from({ length: 200 }, (_, s) => pickMon(pal, new Rng(s + 1), { owned: new Set([top]) }).mon.id);
    expect(again.filter((x) => x === top).length).toBeLessThan(base.filter((x) => x === top).length);
    expect(MON_BY_ID.has(top)).toBe(true);
  });
});
