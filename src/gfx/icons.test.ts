import { describe, expect, it } from 'vitest';
import { ICON } from './icons';

describe('icons', () => {
  it('are non-empty and drawn with a palette colour or transparency', () => {
    for (const [name, sprite] of Object.entries(ICON)) {
      expect(sprite.w, name).toBeGreaterThan(2);
      expect(sprite.h, name).toBeGreaterThan(2);
      expect(sprite.px.length, name).toBe(sprite.w * sprite.h);
      expect(Array.from(sprite.px).some((c) => c !== 255), name).toBe(true);
    }
  });
});
