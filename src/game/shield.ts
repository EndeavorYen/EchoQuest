/**
 * The boss's shield. While any layer is up, a grown-up's spell just bounces off;
 * a child's spell strips one layer (and still hurts). Once it is down, everybody
 * can attack. If the party has no children (a lone adult, say) everyone counts
 * as a child so the fight can always be won.
 */
export type ShieldOutcome = 'bounce' | 'break' | 'hit';

export class Shield {
  layers: number;

  constructor(readonly max: number) {
    this.layers = max;
  }

  get up(): boolean {
    return this.layers > 0;
  }

  /** Who the shield lets through: kids always; adults only when no kid is playing or the shield is down. */
  static bounces(adult: boolean, partyHasKid: boolean, shieldUp: boolean): boolean {
    return shieldUp && adult && partyHasKid;
  }

  /** A correctly spoken spell lands. */
  resolve(adult: boolean, partyHasKid: boolean): ShieldOutcome {
    if (!this.up) return 'hit';
    if (Shield.bounces(adult, partyHasKid, true)) return 'bounce';
    this.layers -= 1;
    return 'break';
  }
}
