import { describe, expect, it } from 'vitest';
import { Shield } from './shield';

describe('boss shield', () => {
  it('bounces a grown-up while it is up, but a child strips a layer', () => {
    const s = new Shield(3);
    expect(s.resolve(true, true)).toBe('bounce');
    expect(s.layers).toBe(3);
    expect(s.resolve(false, true)).toBe('break');
    expect(s.layers).toBe(2);
  });

  it('is gone after the last layer and then lets everyone hit', () => {
    const s = new Shield(2);
    s.resolve(false, true);
    s.resolve(false, true);
    expect(s.up).toBe(false);
    expect(s.resolve(true, true)).toBe('hit');
    expect(s.resolve(false, true)).toBe('hit');
  });

  it('never gets stuck: with no child in the party, adults can break it', () => {
    const s = new Shield(1);
    expect(s.resolve(true, false)).toBe('break');
    expect(s.up).toBe(false);
  });

  it('is not up with zero layers', () => {
    expect(new Shield(0).resolve(true, true)).toBe('hit');
  });
});
