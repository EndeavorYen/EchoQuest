import type { Accessory, MonsterSpec } from '../gfx/monster';
import type { RampName } from '../gfx/palette';

/** Taps it takes for a friend to grow up into a sticker. */
export const TODDLER_TAPS = 5;
export const MAX_STICKERS = 60;

const RAMP_ORDER: RampName[] = ['fire', 'berry', 'leaf', 'water', 'sky', 'sun', 'plum', 'ghost', 'night'];
const GROW: Accessory[] = ['none', 'ears', 'sprout', 'antenna', 'crown'];

/** The looks a friend goes through, one per tap; the last one is the sticker (its own colours, with a crown). */
export function growthSpecs(spec: MonsterSpec): MonsterSpec[] {
  const start = Math.max(0, RAMP_ORDER.indexOf(spec.ramp));
  return Array.from({ length: TODDLER_TAPS }, (_, i) => ({
    ...spec,
    ramp: i === TODDLER_TAPS - 1 ? spec.ramp : RAMP_ORDER[(start + 1 + i * 2) % RAMP_ORDER.length],
    accessory: GROW[i],
    boss: false,
  }));
}

/** Add a sticker to the front of the book, capped so the save stays small. */
export function addSticker(book: MonsterSpec[], s: MonsterSpec): MonsterSpec[] {
  return [s, ...book].slice(0, MAX_STICKERS);
}
