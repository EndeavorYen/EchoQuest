import type { Grade } from '../mon/rarity';

/**
 * The "caught it" moment after a win: the creature is drawn into a ball, the ball drops, wobbles
 * three times and locks. Times are in ms from the moment of the win; the screen animation, the
 * sounds and the phone's vibration all hang off the same beats.
 */
export type BeatKind = 'suck' | 'wobble' | 'lock';

export interface Beat {
  at: number;
  kind: BeatKind;
  /** which wobble (1–3); 0 for the others */
  n: number;
}

export const SUCK_MS = 550;
export const LAND_AT = 900;
export const WOBBLE_AT = [1000, 1400, 1800];
export const WOBBLE_MS = 360;
export const LOCK_AT = 2250;
/** when the victory panel may appear */
export const CAPTURE_MS = 2700;

export const BEATS: Beat[] = [
  { at: 0, kind: 'suck', n: 0 },
  ...WOBBLE_AT.map((at, i): Beat => ({ at, kind: 'wobble', n: i + 1 })),
  { at: LOCK_AT, kind: 'lock', n: 0 },
];

export const BALL_COLOR: Record<Grade, string> = { common: '#e74c3c', rare: '#3b82f6', legend: '#f5b800' };

/** One vibration pattern per beat; a legendary lock rumbles for longer. */
export function vibrationFor(kind: BeatKind, grade: Grade): number[] {
  if (kind === 'suck') return [35];
  if (kind === 'wobble') return [20];
  if (grade === 'legend') return [140, 80, 60, 80, 60, 80, 200];
  if (grade === 'rare') return [140, 70, 90];
  return [140];
}
