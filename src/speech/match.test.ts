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
