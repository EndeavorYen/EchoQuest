import { afterEach, describe, expect, it, vi } from 'vitest';
import { BEATS, CAPTURE_MS, LAND_AT, SUCK_MS, vibrationFor } from './capture';
import { haptics } from '../audio/haptics';

describe('capture timeline', () => {
  it('is suck, three wobbles, then lock, in order and inside the total time', () => {
    expect(BEATS.map((b) => b.kind)).toEqual(['suck', 'wobble', 'wobble', 'wobble', 'lock']);
    expect(BEATS.map((b) => b.at)).toEqual([...BEATS.map((b) => b.at)].sort((a, b) => a - b));
    expect(BEATS.filter((b) => b.kind === 'wobble').map((b) => b.n)).toEqual([1, 2, 3]);
    expect(LAND_AT).toBeGreaterThan(SUCK_MS);
    expect(BEATS[1].at).toBeGreaterThanOrEqual(LAND_AT);
    expect(CAPTURE_MS).toBeGreaterThan(BEATS[4].at + 200);
    expect(CAPTURE_MS).toBeLessThanOrEqual(3000);
  });
  it('the lock is the heaviest buzz, and a legend rumbles longest', () => {
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    expect(sum(vibrationFor('lock', 'common'))).toBeGreaterThan(sum(vibrationFor('wobble', 'common')));
    expect(sum(vibrationFor('lock', 'legend'))).toBeGreaterThan(sum(vibrationFor('lock', 'rare')));
    expect(sum(vibrationFor('lock', 'rare'))).toBeGreaterThan(sum(vibrationFor('lock', 'common')));
  });
});

describe('haptics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    haptics.enabled = true;
  });
  it('buzzes only when switched on and supported; never throws', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    haptics.pulse([20]);
    expect(vibrate).toHaveBeenCalledWith([20]);
    haptics.enabled = false;
    haptics.pulse([20]);
    expect(vibrate).toHaveBeenCalledTimes(1);
    haptics.enabled = true;
    vi.stubGlobal('navigator', {});
    expect(haptics.supported).toBe(false);
    expect(() => haptics.pulse(30)).not.toThrow();
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('blocked'); } });
    expect(() => haptics.pulse(30)).not.toThrow();
  });
});
