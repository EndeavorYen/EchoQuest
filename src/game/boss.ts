/**
 * Co-op boss fight. Nobody can beat a boss alone:
 *   1. launch  – someone (usually the grown-up) casts a super spell and is bounced off the boss's shield;
 *   2. rescue  – everybody else casts status moves (stun, sleep, paralysis …), each success strips one shield layer
 *                and helps the bounced player recover;
 *   3. finish  – with the shield gone the bounced player stands up and casts a harder word to end it.
 * Failing is never punished: a missed word just comes around again.
 */
export type BossStage = 'launch' | 'rescue' | 'finish' | 'done';

export interface StatusMove {
  id: 'stun' | 'sleep' | 'paralyze';
  name: string;
  zh: string;
}

export const STATUS_MOVES: readonly StatusMove[] = [
  { id: 'stun', name: 'STUN', zh: '暈眩' },
  { id: 'sleep', name: 'SLEEP', zh: '睡眠' },
  { id: 'paralyze', name: 'PARALYZE', zh: '麻痺' },
];

export const BOSS_LAYERS = 3;

export class BossFight {
  stage: BossStage = 'launch';
  layers: number;
  /** index (in the party) of whoever got bounced */
  launcher: number | null = null;

  constructor(readonly maxLayers = BOSS_LAYERS) {
    this.layers = maxLayers;
  }

  /** Someone cast the super spell: they are bounced and the rescue begins. */
  launch(player: number): void {
    if (this.stage !== 'launch') return;
    this.launcher = player;
    this.stage = 'rescue';
  }

  /** The status move that strips the next layer. */
  get move(): StatusMove {
    return STATUS_MOVES[(this.maxLayers - this.layers) % STATUS_MOVES.length];
  }

  /** A status move landed. Returns true when that was the last layer. */
  breakLayer(): boolean {
    if (this.stage !== 'rescue') return false;
    this.layers = Math.max(0, this.layers - 1);
    if (this.layers === 0) this.stage = 'finish';
    return this.layers === 0;
  }

  /** How much of the bounced player has recovered (0 → 1). */
  get recovery(): number {
    return this.stage === 'launch' ? 1 : (this.maxLayers - this.layers) / this.maxLayers;
  }

  finish(): void {
    this.stage = 'done';
  }

  /**
   * Who may act right now. Launching: anyone. Rescuing: everyone but the bounced player.
   * Finishing: only the bounced player. A solo player plays every role.
   */
  canAct(player: number, partySize: number): boolean {
    if (partySize <= 1) return true;
    if (this.stage === 'launch') return true;
    if (this.stage === 'rescue') return player !== this.launcher;
    if (this.stage === 'finish') return player === this.launcher;
    return false;
  }

  /** Someone who should be up now (for auto-selecting after a stage change). */
  nextActor(current: number, partySize: number): number {
    if (this.canAct(current, partySize)) return current;
    for (let i = 0; i < partySize; i++) if (this.canAct(i, partySize)) return i;
    return current;
  }
}
