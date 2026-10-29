import type { Player } from '../game/model';
import { MON_BY_ID, starterFor, type Mon } from '../mon/dex';

/** The creature that fights for a player: their own pick, or a starter by seat. */
export function partnerMon(p: Player, seat: number): Mon {
  return (p.mon !== undefined ? MON_BY_ID.get(p.mon) : undefined) ?? starterFor(seat);
}
