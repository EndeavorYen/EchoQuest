import { describe, expect, it } from 'vitest';
import { inkOn, starsHtml, typeChip } from './ui';
import { TYPES } from '../mon/dex';
import { plausible, learnHearing } from '../speech/learn';
import { WORDS } from '../data/words';
import { dealCard, pickDefenseWord, dealHardCard } from '../game/deck';
import { newPlayer } from '../game/model';
import { Rng } from '../util/rng';
import { load } from '../game/save';

describe('readable type chips', () => {
  it('light colours get dark text, dark colours white text', () => {
    expect(inkOn('#F8D030')).toBe('#1f2a44'); // electric yellow
    expect(inkOn('#ffffff')).toBe('#1f2a44');
    expect(inkOn('#1f2a44')).toBe('#fff');
    expect(inkOn('#705898')).toBe('#fff'); // ghost purple
  });
  it('every type chip reaches at least 3:1 contrast', () => {
    const lum = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    };
    for (const t of Object.values(TYPES)) {
      const a = lum(t.color.length === 7 ? t.color : '#888888');
      const b = lum(inkOn(t.color) === '#fff' ? '#ffffff' : '#1f2a44');
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(ratio, t.name).toBeGreaterThanOrEqual(3);
      expect(typeChip(t)).toContain(`color:${inkOn(t.color)}`);
    }
  });
  it('rarity stars dim the empty ones', () => {
    expect(starsHtml(2)).toBe('★★<span class="off">☆☆☆</span>');
    expect(starsHtml(5)).toBe('★★★★★');
  });
});

describe('a ✓ tap only teaches plausible hearings', () => {
  it('keeps letter names, shared first/last letters and near spellings; drops nonsense', () => {
    expect(plausible('b', 'bee')).toBe(true);
    expect(plausible('c', 'see')).toBe(true);
    expect(plausible('ag', 'egg')).toBe(true);
    expect(plausible('grandpa', 'grandfather')).toBe(true);
    expect(plausible('banana', 'grandfather')).toBe(false);
    expect(plausible('zork', 'egg')).toBe(false);
  });
  it('strict learning skips the nonsense, the classic game still learns everything', () => {
    const egg = WORDS.find((w) => w.w === 'egg')!;
    expect(learnHearing({}, egg, ['zork'], { strict: true })).toEqual({});
    expect(learnHearing({}, egg, ['ag'], { strict: true })[egg.id]).toEqual(['ag']);
    expect(learnHearing({}, egg, ['zork'])[egg.id]).toEqual(['zork']);
  });
});

describe('the youngest get words with pictures', () => {
  it('level 1 attack, hard and shield cards nearly always have a picture', () => {
    const p = newPlayer(0, 1);
    let pics = 0;
    for (let s = 0; s < 200; s++) {
      const r = new Rng(s);
      if (dealCard(p, 0, r).word.icon) pics++;
      expect(dealHardCard(p, 0, new Rng(s)).word.icon).toBeTruthy();
      expect(pickDefenseWord(p, 0, new Rng(s)).icon).toBeTruthy();
    }
    expect(pics).toBe(200);
  });
  it('older players are not limited to picture words', () => {
    const p = newPlayer(0, 3);
    expect(Array.from({ length: 100 }, (_, s) => dealCard(p, 0, new Rng(s)).word.icon).some((x) => !x)).toBe(true);
  });
});

describe('a broken save never stops the game from starting', () => {
  const mem = (raw: unknown) => {
    const m = new Map<string, string>([['echoquest.v3', JSON.stringify(raw)]]);
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  it('drops non-player entries, clamps the level and the active seat', () => {
    const s = mem({ v: 3, players: [{ name: 'A', level: 7, progress: null }, null, 42], active: -1 });
    const save = load(s);
    expect(save.players).toHaveLength(1);
    expect(save.players[0].level).toBe(4);
    expect(save.players[0].progress).toEqual({});
    expect(save.active).toBe(0);
  });
  it('an empty party gets a first player', () => {
    expect(load(mem({ v: 3, players: [] })).players).toHaveLength(1);
  });
});
