import { describe, expect, it } from 'vitest';
import { judge, normalize, similarity } from './match';

describe('normalize', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalize('  Apple! ')).toBe('apple');
  });
  it('turns digits into words', () => {
    expect(normalize('2')).toBe('two');
  });
});

describe('similarity', () => {
  it('is 1 for equal strings and lower for near misses', () => {
    expect(similarity('cat', 'cat')).toBe(1);
    expect(similarity('cat', 'cut')).toBeCloseTo(0.667, 2);
    expect(similarity('cat', 'xyz')).toBe(0);
  });
});

describe('judge', () => {
  it('accepts an exact match as perfect', () => {
    expect(judge('apple', ['apple'], 3).tier).toBe('perfect');
  });
  it('finds the word among several alternatives', () => {
    const r = judge('banana', ['bandana', 'banana', 'bonanza'], 3);
    expect(r.tier).toBe('perfect');
    expect(r.heard).toBe('banana');
  });
  it('accepts the word inside a longer phrase', () => {
    expect(judge('dog', ['the dog'], 4).tier).toBe('perfect');
  });
  it('accepts homophones', () => {
    expect(judge('read', ['red'], 4).tier).toBe('perfect');
    expect(judge('two', ['2'], 4).tier).toBe('perfect');
  });
  it('is kinder to little kids than to teenagers', () => {
    // "cat" heard as "cut" is 0.67 similar
    expect(judge('cat', ['cut'], 1).tier).toBe('perfect');
    expect(judge('cat', ['cut'], 4).tier).toBe('good');
  });
  it('misses when nothing is close', () => {
    expect(judge('elephant', ['hello'], 3).tier).toBe('miss');
  });
  it('handles empty input', () => {
    expect(judge('apple', [], 2).tier).toBe('miss');
    expect(judge('apple', [''], 2).tier).toBe('miss');
  });
});

import { soundKey, soundSimilarity } from './sound';
import { learnHearing, knownHearings, MAX_ALIASES } from './learn';
import { logHeard, readLog, exportLog, MAX_LOG } from './heardlog';
import { WORDS, WORD_BY_ID } from '../data/words';

describe('sound keys', () => {
  it('blur short vowels and similar consonants', () => {
    expect(soundKey('egg')).toBe(soundKey('ag'));
    expect(soundKey('egg')).toBe(soundKey('eck'));
    expect(soundKey('bed')).toBe(soundKey('pet'));
    expect(soundKey('phone')).toBe(soundKey('fone'));
    expect(soundKey('knee')).toBe(soundKey('nee'));
  });
  it('speaks a lone letter as its name', () => {
    expect(soundKey('x')).toBe(soundKey('eks'));
  });
  it('keeps clearly different words apart', () => {
    expect(soundSimilarity('elephant', 'hello')).toBeLessThan(0.5);
    expect(soundKey('apple')).not.toBe(soundKey('banana'));
  });
});

describe('hard-to-recognise words', () => {
  // what real engines tend to return for a lone, short, vowel-first word
  const eggHeard = ['eg', 'ag', 'agg', 'eck', 'eggs', 'Egg.', 'ACK'];
  it('"egg" is accepted for every plausible mishearing, at every level', () => {
    for (const lv of [1, 2, 3, 4]) {
      for (const h of eggHeard) expect(judge('egg', [h], lv).tier, `${h} @${lv}`).not.toBe('miss');
    }
  });
  it('"egg" is accepted when the right answer is only one of the engine alternatives', () => {
    expect(judge('egg', ['I', 'a', 'ag'], 4).tier).not.toBe('miss');
  });
  it('the word bank carries extra hints for words engines notoriously get wrong', () => {
    const egg = WORDS.find((w) => w.w === 'egg')!;
    expect(egg.heard?.length).toBeGreaterThan(3);
    for (const h of ['a', 'x', 'ex', 'ache']) expect(judge('egg', [h], 4, egg.heard).tier, h).toBe('perfect');
  });
  it('plurals and extra words do not matter', () => {
    expect(judge('egg', ['eggs'], 4).tier).toBe('perfect');
    expect(judge('banana', ['a banana please'], 4).tier).toBe('perfect');
  });
  it('still rejects unrelated words', () => {
    for (const h of ['hello', 'dog', 'tree', 'banana']) expect(judge('egg', [h], 2).tier, h).toBe('miss');
    expect(judge('elephant', ['telephone'], 4).tier).not.toBe('perfect');
  });
  it('few different words get accepted for each other (a lenient but not a free pass)', () => {
    let n = 0;
    let hit = 0;
    const step = Math.max(1, Math.floor(WORDS.length / 80));
    const sample = WORDS.filter((_, i) => i % step === 0);
    for (const a of sample) for (const b of sample) {
      if (a.id === b.id) continue;
      n += 1;
      if (judge(a.w, [b.w], 3).tier !== 'miss') hit += 1;
    }
    expect(hit / n).toBeLessThan(0.01);
  });
});

describe('learning from a grown-up', () => {
  const egg = WORD_BY_ID.get('egg:n')!;
  it('remembers confirmed mishearings and then accepts them', () => {
    const none = {};
    expect(judge('egg', ['zork'], 4).tier).toBe('miss');
    const learned = learnHearing(none, egg, ['Zork!', 'egg', 'a long phrase that is too long']);
    expect(learned[egg.id]).toEqual(['zork']);
    expect(judge('egg', ['zork'], 4, knownHearings(learned, egg)).tier).toBe('perfect');
  });
  it('keeps the list short and never stores the word itself', () => {
    let al = {};
    for (let i = 0; i < 30; i++) al = learnHearing(al, egg, [`mis${String.fromCharCode(97 + (i % 26))}${i}`]);
    expect((al as Record<string, string[]>)[egg.id]).toHaveLength(MAX_ALIASES);
    expect(learnHearing({}, egg, ['egg'])).toEqual({});
  });
});

describe('heard log', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('records attempts, stays small, and exports', () => {
    const s = mem();
    for (let i = 0; i < MAX_LOG + 20; i++) logHeard({ w: 'egg', c: ['ag', 'eg'], r: 'good', lv: 1 }, s, 1_000_000);
    expect(readLog(s)).toHaveLength(MAX_LOG);
    expect(JSON.parse(exportLog(s))[0]).toMatchObject({ w: 'egg', c: ['ag', 'eg'], r: 'good', t: 1000 });
  });
  it('survives broken storage', () => {
    const s = { getItem: () => '{nope', setItem: () => { throw new Error('full'); } };
    expect(readLog(s)).toEqual([]);
    expect(() => logHeard({ w: 'a', c: [], r: 'miss', lv: 1 }, s)).not.toThrow();
  });
});
