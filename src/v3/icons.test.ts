import { describe, expect, it } from 'vitest';
import { GLYPHS, ICON_NAMES, glyph, svg } from './icons';
import { RELICS } from '../game/run';
import { STATUS } from '../game/status';
import { PLACES } from '../mon/habitat';
import { kindLabel, roadIcon, generateTownMap } from '../game/townmap';

const covered = (e: string): boolean => glyph(e).startsWith('<svg');

describe('icons', () => {
  it('every glyph points at an icon that exists', () => {
    for (const name of Object.values(GLYPHS)) expect(ICON_NAMES).toContain(name);
  });
  it('draws every symbol the interface shows', () => {
    for (const r of RELICS) expect(covered(r.icon), `${r.id} ${r.icon}`).toBe(true);
    for (const s of Object.values(STATUS)) expect(covered(s.icon), s.id).toBe(true);
    for (const h of Object.values(PLACES)) expect(covered(h.icon), h.zh).toBe(true);
    for (const e of Object.values(roadIcon)) expect(covered(e), e).toBe(true);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const n of generateTownMap(seed).nodes) if (n.icon) expect(covered(n.icon), `${n.kind} ${n.icon}`).toBe(true);
    expect(Object.keys(kindLabel).length).toBeGreaterThan(5);
  });
  it('leaves word pictures alone', () => {
    expect(glyph('🐶')).toBe('🐶');
    expect(glyph(undefined)).toBe('');
  });
  it('is plain markup with the ink outline', () => {
    expect(svg('house')).toMatch(/^<svg class="ico /);
    expect(svg('house')).toContain('stroke="#1f2a44"');
  });
});
