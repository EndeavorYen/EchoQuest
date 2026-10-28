/**
 * One fixed 16-colour palette for the whole game (Sweetie 16 by GrafxKid).
 * Everything on screen — sprites, UI, even the camera feed — is forced through
 * these colours, which is what makes the game look like one hand-made thing
 * instead of a pile of mismatched assets.
 */
export const HEX = [
  '#1a1c2c', // 0 ink (outlines, darkest)
  '#5d275d', // 1 plum
  '#b13e53', // 2 berry
  '#ef7d57', // 3 orange
  '#ffcd75', // 4 sun
  '#a7f070', // 5 lime
  '#38b764', // 6 leaf
  '#257179', // 7 teal
  '#29366f', // 8 navy
  '#3b5dc9', // 9 royal
  '#41a6f6', // 10 sky
  '#73eff7', // 11 ice
  '#f4f4f4', // 12 snow
  '#94b0c2', // 13 mist
  '#566c86', // 14 slate
  '#333c57', // 15 dusk
] as const;

export const C = {
  ink: 0,
  plum: 1,
  berry: 2,
  orange: 3,
  sun: 4,
  lime: 5,
  leaf: 6,
  teal: 7,
  navy: 8,
  royal: 9,
  sky: 10,
  ice: 11,
  snow: 12,
  mist: 13,
  slate: 14,
  dusk: 15,
} as const;

export type PalIndex = number;

export const RGB: ReadonlyArray<readonly [number, number, number]> = HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

export function hex(i: PalIndex): string {
  return HEX[i] ?? HEX[0];
}

/** Colour ramps, light → dark, used for shaded sprites. */
export const RAMPS = {
  fire: [C.sun, C.orange, C.berry, C.plum],
  berry: [C.orange, C.berry, C.plum, C.ink],
  leaf: [C.lime, C.leaf, C.teal, C.navy],
  water: [C.ice, C.sky, C.royal, C.navy],
  sky: [C.sky, C.royal, C.navy, C.ink],
  sun: [C.snow, C.sun, C.orange, C.berry],
  ghost: [C.snow, C.mist, C.slate, C.dusk],
  night: [C.mist, C.slate, C.dusk, C.ink],
  plum: [C.mist, C.plum, C.dusk, C.ink],
} as const;

export type RampName = keyof typeof RAMPS;

/** Squared distance between two RGB triples. */
export function dist2(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr * 3 + dg * dg * 4 + db * db * 2; // weighted toward green, like the eye
}

let lut: Uint8Array | null = null;

/**
 * 5-bit-per-channel lookup table: RGB → nearest palette index.
 * 32768 entries, built once, makes per-pixel quantising of the camera cheap.
 */
export function nearestLut(): Uint8Array {
  if (lut) return lut;
  lut = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        const rr = (r << 3) | (r >> 2);
        const gg = (g << 3) | (g >> 2);
        const bb = (b << 3) | (b >> 2);
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < RGB.length; i++) {
          const d = dist2(rr, gg, bb, RGB[i][0], RGB[i][1], RGB[i][2]);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        lut[(r << 10) | (g << 5) | b] = best;
      }
    }
  }
  return lut;
}
