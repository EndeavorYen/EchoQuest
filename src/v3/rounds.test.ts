import { afterEach, describe, expect, it } from 'vitest';
import { Rng } from '../util/rng';
import { WORDS, type Word } from '../data/words';
import { canListen, canSpell, chooseRound, DEFAULT_ROUNDS, forceRound, listenChoices, memoryDeck, soundsAlike, spellPuzzle } from './rounds';
import { dealHardCard, recordHard, rollHard } from '../game/deck';
import { newPlayer } from '../game/model';

const w = (s: string): Word => WORDS.find((x) => x.w === s)!;
const withIcon = (lv: number) => WORDS.filter((x) => x.lv === lv && x.icon && /^[a-z]{3,8}$/.test(x.w));

describe('which round', () => {
  afterEach(() => forceRound(null));
  const base = { prefs: DEFAULT_ROUNDS, level: 2, round: 3, memoryUsed: false, revenge: false };

  it('the first card of a fight and revenge cards are always spoken', () => {
    const word = withIcon(2)[0];
    for (let s = 0; s < 50; s++) {
      expect(chooseRound({ ...base, rng: new Rng(s), word, round: 1 })).toBe('speak');
      expect(chooseRound({ ...base, rng: new Rng(s), word, revenge: true })).toBe('speak');
    }
  });
  it('mostly speaking, with some of each other kind', () => {
    const word = withIcon(2)[0];
    const count: Record<string, number> = {};
    for (let s = 0; s < 2000; s++) {
      const t = chooseRound({ ...base, rng: new Rng(s), word });
      count[t] = (count[t] ?? 0) + 1;
    }
    expect(count.speak).toBeGreaterThan(900);
    for (const k of ['listen', 'spell', 'memory']) expect(count[k], k).toBeGreaterThan(80);
  });
  it('switched-off kinds never appear; memory at most once a fight', () => {
    const word = withIcon(2)[0];
    for (let s = 0; s < 500; s++) {
      const t = chooseRound({ ...base, rng: new Rng(s), word, prefs: { listen: false, spell: false, memory: false } });
      expect(t).toBe('speak');
      expect(chooseRound({ ...base, rng: new Rng(s), word, memoryUsed: true })).not.toBe('memory');
    }
  });
  it('non-readers never get spelling, and only picture listening', () => {
    expect(canSpell(withIcon(1)[0], 1)).toBe(false);
    const noPic = WORDS.find((x) => x.lv === 1 && !x.icon)!;
    expect(canListen(noPic, 1)).toBe(false);
    expect(canListen(noPic, 2)).toBe(true);
  });
  it('a forced kind is used when the word allows it', () => {
    forceRound('spell');
    expect(chooseRound({ ...base, rng: new Rng(1), word: withIcon(2)[0], round: 1 })).toBe('spell');
    expect(chooseRound({ ...base, rng: new Rng(1), word: withIcon(1)[0], level: 1 })).toBe('speak');
  });
});

describe('hear it, pick it', () => {
  it('pictures: the word plus look-alikes that never share a picture', () => {
    for (let s = 0; s < 50; s++) {
      const word = withIcon(1)[s % withIcon(1).length];
      const r = listenChoices(word, 1, new Rng(s))!;
      expect(r.mode).toBe('pic');
      expect(r.options).toHaveLength(2);
      expect(r.options.map((o) => o.id)).toContain(word.id);
      expect(new Set(r.options.map((o) => o.icon)).size).toBe(2);
      expect(listenChoices(word, 3, new Rng(s))!.options).toHaveLength(3);
    }
  });
  it('words without a picture use their meanings, for readers only', () => {
    const word = WORDS.find((x) => x.lv === 3 && !x.icon)!;
    const r = listenChoices(word, 3, new Rng(3))!;
    expect(r.mode).toBe('zh');
    expect(new Set(r.options.map((o) => o.zh)).size).toBe(3);
    for (let s = 0; s < 40; s++) {
      const q = listenChoices(WORDS.filter((x) => x.lv === 3 && !x.icon)[s], 3, new Rng(s))!;
      const sets = q.options.map((o) => new Set(o.zh.replace(/[的地得之、，,;；（）()\s]/g, '').split('')));
      for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) expect([...sets[i]].some((c) => sets[j].has(c))).toBe(false);
    }
    expect(listenChoices(WORDS.find((x) => x.lv === 1 && !x.icon)!, 1, new Rng(1))).toBeNull();
  });
});

describe('fill in the letters', () => {
  it('level 2: one gap, never the first letter; tiles hold the answer and two decoys', () => {
    for (let s = 0; s < 60; s++) {
      const p = spellPuzzle(w('apple') ?? withIcon(2)[0], 2, new Rng(s));
      expect(p.blanks).toHaveLength(1);
      expect(p.blanks[0]).toBeGreaterThan(0);
      expect(p.tiles).toHaveLength(3);
      expect(p.tiles).toContain(p.letters[p.blanks[0]]);
      for (const t of p.tiles.filter((x) => x !== p.letters[p.blanks[0]])) expect(p.letters).not.toContain(t);
    }
  });
  it('more gaps at higher levels, in order, never the whole word', () => {
    const word = withIcon(2).find((x) => x.w.length === 3)!;
    const p3 = spellPuzzle(word, 3, new Rng(5));
    expect(p3.blanks).toHaveLength(2);
    expect([...p3.blanks].sort((a, b) => a - b)).toEqual(p3.blanks);
    expect(spellPuzzle(word, 4, new Rng(5)).blanks).toHaveLength(2); // a 3-letter word keeps one letter
  });
});

describe('memory match', () => {
  it('three pairs including the dealt word; readers match a picture to its word', () => {
    const word = withIcon(2)[2];
    const d = memoryDeck(word, 2, new Rng(4))!;
    expect(d).toHaveLength(6);
    expect(d.filter((c) => c.word.id === word.id)).toHaveLength(2);
    for (const c of d) expect(d.filter((x) => x.word.id === c.word.id).map((x) => x.face).sort()).toEqual(['pic', 'word']);
    expect(memoryDeck(word, 1, new Rng(4))!.every((c) => c.face === 'pic')).toBe(true);
    expect(memoryDeck(WORDS.find((x) => !x.icon)!, 2, new Rng(1))).toBeNull();
  });
});

describe('hard cards', () => {
  it('never two hard cards within three, and none at rank 0', () => {
    const rng = new Rng(9);
    const hist: boolean[] = [];
    for (let i = 0; i < 3000; i++) hist.push(rollHard(3, hist, rng));
    for (let i = 2; i < hist.length; i++) expect(hist.slice(i - 2, i + 1).filter(Boolean).length).toBeLessThanOrEqual(1);
    const rate = hist.filter(Boolean).length / hist.length;
    // the chance is a third, but the gap rule after each hard card brings it to about a fifth
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.27);
    expect(Array.from({ length: 200 }, () => rollHard(0, [], rng)).some(Boolean)).toBe(false);
  });
  it('a hard card is one level up; level 4 gets a long word', () => {
    for (const lv of [1, 2, 3] as const) {
      const c = dealHardCard(newPlayer(0, lv), 0, new Rng(lv));
      expect(c.hard).toBe(true);
      expect(c.word.lv).toBe(lv + 1);
    }
    const top = dealHardCard(newPlayer(0, 4), 0, new Rng(4));
    expect(top.word.lv).toBe(4);
    expect(top.word.w.replace(/[^a-z]/gi, '').length).toBeGreaterThanOrEqual(8);
  });
});

describe('the hard-card history', () => {
  it('a re-deal before answering replaces the last card instead of adding one', () => {
    let h = recordHard([], true, false);
    h = recordHard(h, false, false);
    expect(h).toEqual([true, false]);
    // the party switches player before answering: the false card is replaced, not stacked
    h = recordHard(h, false, true);
    expect(h).toEqual([true, false]);
    // so the next roll still sees the hard card within the last two
    expect(Array.from({ length: 300 }, (_, s) => rollHard(3, h, new Rng(s))).some(Boolean)).toBe(false);
    expect(recordHard([true, false, false], true, false)).toEqual([false, false, true]);
  });
});

describe('choices that would sound the same', () => {
  it('same spelling or a known sound-alike never appear together', () => {
    const find = (s: string) => WORDS.find((x) => x.w === s);
    const sun = find('sun');
    const son = find('son');
    if (sun && son) expect(soundsAlike(sun, son)).toBe(true);
    const twins = WORDS.filter((a) => WORDS.some((b) => b !== a && b.w === a.w && b.icon && a.icon && b.icon !== a.icon));
    for (const a of twins.slice(0, 20)) {
      for (let s = 0; s < 20; s++) {
        const r = listenChoices(a, 2, new Rng(s));
        if (!r) continue;
        expect(r.options.filter((o) => o.w === a.w)).toHaveLength(1);
      }
    }
    for (let s = 0; s < 200; s++) {
      const word = withIcon(1)[s % withIcon(1).length];
      const r = listenChoices(word, 1, new Rng(s));
      if (r) expect(soundsAlike(r.options[0], r.options[1])).toBe(false);
      const d = memoryDeck(word, 2, new Rng(s));
      if (d) expect(new Set(d.filter((c) => c.face === 'word').map((c) => c.word.w)).size).toBe(3);
    }
  });
});
