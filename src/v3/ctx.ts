import type { Save } from '../game/save';
import type { Recognizer } from '../speech/recognizer';
import type { Rng } from '../util/rng';
import type { Mon } from '../mon/dex';

export type ScreenName = 'home' | 'trek' | 'scan' | 'battle' | 'dex' | 'party' | 'practice' | 'toddler';

export interface ScanParams {
  kind: 'trek' | 'toddler';
  boss?: boolean;
  rare?: boolean;
  /** the creature to meet (the trek decides it from the place); without it the scan screen picks one with the camera */
  foe?: Mon;
  /** the ground the encounter happens on: decides who lives there when the party does not use the camera */
  place?: { key: 'meadow' | 'forest' | 'lake' | 'cave' | 'gym'; types: string[]; maxRarity: number; minRarity?: number; label?: string; icon?: string };
}
export interface BattleParams { foe: Mon; boss?: boolean; trek?: boolean }
export interface ScreenParams { scan?: ScanParams; battle?: BattleParams; toddler?: { foe?: Mon; book?: boolean } }

export interface Ctx {
  save: Save;
  rec: Recognizer;
  rng: Rng;
  /** change the save (and store it) */
  update(fn: (s: Save) => Save): void;
  go(name: ScreenName, params?: unknown): void;
}

/** Every screen builds its own DOM into `root` and cleans up after itself in destroy(). */
export interface Screen { destroy?(): void }
export type ScreenFactory = (root: HTMLElement, ctx: Ctx, params: any) => Screen | void; // eslint-disable-line @typescript-eslint/no-explicit-any

export const BACK_SVG = '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>';

export function bar(title: string, back: ScreenName | null = 'home', right = ''): string {
  return `<div class="bar">${back ? `<button class="icon-btn" data-go="${back}" aria-label="返回">${BACK_SVG}</button>` : ''}<h1>${title}</h1>${right}</div>`;
}

export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
