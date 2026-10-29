/**
 * The trek map: a branching trail that is generated from a seed, so every trek is a new map.
 *
 * Shape: rows from a start stone (row 0) up to a single boss (last row). Every row in between
 * holds two or three stops. Paths only run from one row to the next, never cross, and every
 * stop can be reached from the start and leads on to the boss. Some stops have several ways
 * in or out, so the party chooses its own route.
 *
 * Losing or running away changes nothing: the party simply stays where it was standing.
 */
import type { Theme } from '../gfx/backdrop';
import { Rng } from '../util/rng';

export type Kind = 'start' | 'monster' | 'rare' | 'chest' | 'boss';

export interface Stop {
  id: number;
  kind: Kind;
  theme: Theme;
  row: number;
  col: number;
  /** ids in the next row this stop connects to */
  next: number[];
}

export interface Trail {
  seed: number;
  /** 1 for the first map; later maps are longer */
  region: number;
  stops: Stop[];
  /** where the party stands */
  at: number;
  cleared: number[];
  /** the stop being played right now (set when a fight starts, cleared when it ends) */
  target: number | null;
}

const THEMES: Theme[] = ['meadow', 'night', 'cave'];

/** Middle rows (not counting start and boss): grows with each map, up to a cap. */
export const midRows = (region: number): number => Math.min(10, 4 + Math.max(1, region));

export function generateTrail(seed: number, region = 1): Trail {
  const rng = new Rng(seed);
  const mid = midRows(region);
  const widths = [1];
  for (let r = 1; r <= mid; r++) {
    // 2 or 3 wide; the row before the boss narrows so the paths gather there
    widths.push(r === mid ? 2 : rng.chance(0.55) ? 3 : 2);
  }
  widths.push(1);
  const rows = widths.length;

  const stops: Stop[] = [];
  const byRow: Stop[][] = [];
  for (let r = 0; r < rows; r++) {
    byRow.push([]);
    for (let c = 0; c < widths[r]; c++) {
      const s: Stop = { id: stops.length, kind: 'monster', theme: 'meadow', row: r, col: c, next: [] };
      stops.push(s);
      byRow[r].push(s);
    }
  }

  // paths: walk a staircase through the two rows, so lines never cross and no stop is left out
  for (let r = 0; r < rows - 1; r++) {
    const a = byRow[r], b = byRow[r + 1];
    let i = 0, j = 0;
    const link = (): void => { if (!a[i].next.includes(b[j].id)) a[i].next.push(b[j].id); };
    link();
    while (i < a.length - 1 || j < b.length - 1) {
      if (i === a.length - 1) j++;
      else if (j === b.length - 1) i++;
      else {
        const x = rng.next();
        if (x < 0.34) i++; else if (x < 0.68) j++; else { i++; j++; }
      }
      link();
    }
  }

  // what is at each stop
  const parents = (s: Stop): Stop[] => stops.filter((p) => p.next.includes(s.id));
  byRow[0][0].kind = 'start';
  stops[stops.length - 1].kind = 'boss';
  for (let r = 2; r < rows - 1; r++) {
    let chests = 0;
    for (const s of byRow[r]) {
      const nearChest = parents(s).some((p) => p.kind === 'chest');
      if (!nearChest && chests === 0 && rng.chance(0.2)) { s.kind = 'chest'; chests++; }
      else if (r >= 3 && rng.chance(0.2)) s.kind = 'rare';
    }
    if (byRow[r].every((s) => s.kind !== 'monster')) byRow[r][0].kind = 'monster';
  }
  if (!stops.some((s) => s.kind === 'chest')) {
    // every map has at least one chest, in a row that keeps another wild creature
    const pick = stops.find(
      (s) => s.row >= 2 && s.row <= mid && s.kind === 'monster' &&
        byRow[s.row].filter((o) => o.kind === 'monster').length >= 2 && parents(s).every((p) => p.kind !== 'chest'),
    );
    if (pick) pick.kind = 'chest';
  }

  // scenery follows the climb
  for (const s of stops) {
    if (s.kind === 'boss') s.theme = 'sunset';
    else s.theme = THEMES[Math.min(THEMES.length - 1, Math.floor((s.row / (rows - 1)) * THEMES.length))];
  }
  return { seed, region, stops, at: 0, cleared: [0], target: null };
}

export const stopOf = (t: Trail, id: number): Stop | undefined => t.stops[id];

/** The stops the party can walk to from where it stands. */
export function options(t: Trail): Stop[] {
  const here = t.stops[t.at];
  return here ? here.next.map((id) => t.stops[id]).filter(Boolean) : [];
}

/** Mark a stop as the one being played. Only a stop next to the party counts. */
export function begin(t: Trail, id: number): Trail {
  return options(t).some((s) => s.id === id) ? { ...t, target: id } : t;
}

/** The stop was cleared: the party walks there. */
export function arrive(t: Trail, id: number): Trail {
  if (!options(t).some((s) => s.id === id)) return { ...t, target: null };
  return { ...t, at: id, cleared: t.cleared.includes(id) ? t.cleared : [...t.cleared, id], target: null };
}

/** Lost or ran away: nothing changes except that the fight is over. */
export function stay(t: Trail): Trail {
  return t.target === null ? t : { ...t, target: null };
}

export const isDone = (t: Trail): boolean => t.stops[t.at]?.kind === 'boss';

/** Is this stored value a trail we can still use? (Saves from before the branching map have a different shape.) */
export function isTrail(x: unknown): x is Trail {
  const t = x as Trail | null;
  return (
    !!t && typeof t === 'object' && Array.isArray(t.stops) && t.stops.length > 2 && Number.isInteger(t.at) &&
    Array.isArray(t.cleared) && t.stops.every((s, i) => s && s.id === i && Array.isArray(s.next) && s.next.every((n) => Number.isInteger(n) && n > i && n < t.stops.length)) &&
    t.at >= 0 && t.at < t.stops.length
  );
}

/** The rules a generated map must obey. Returns the broken ones (empty = fine). */
export function checkTrail(t: Trail): string[] {
  const bad: string[] = [];
  const rows = Math.max(...t.stops.map((s) => s.row)) + 1;
  const inRow = (r: number): Stop[] => t.stops.filter((s) => s.row === r);
  const parents = (s: Stop): Stop[] => t.stops.filter((p) => p.next.includes(s.id));
  if (t.stops.filter((s) => s.kind === 'start').length !== 1 || t.stops[0].kind !== 'start') bad.push('needs exactly one start at id 0');
  const bosses = t.stops.filter((s) => s.kind === 'boss');
  if (bosses.length !== 1 || bosses[0].row !== rows - 1) bad.push('needs exactly one boss, in the last row');
  for (let r = 1; r < rows - 1; r++) {
    const w = inRow(r).length;
    if (w < 2 || w > 3) bad.push(`row ${r} has ${w} stops (want 2–3)`);
    if (inRow(r).every((s) => s.kind !== 'monster')) bad.push(`row ${r} has no wild creature`);
    if (inRow(r).filter((s) => s.kind === 'chest').length > 1) bad.push(`row ${r} has two chests`);
  }
  for (const s of t.stops) {
    if (s.kind !== 'boss' && s.next.length === 0) bad.push(`stop ${s.id} is a dead end`);
    if (s.kind !== 'start' && parents(s).length === 0) bad.push(`stop ${s.id} cannot be reached`);
    for (const n of s.next) if (t.stops[n].row !== s.row + 1) bad.push(`path ${s.id}→${n} skips a row`);
    if ((s.kind === 'chest' || s.kind === 'rare') && s.row <= 1) bad.push(`stop ${s.id}: no chest or rare in the first row`);
    if (s.kind === 'chest' && parents(s).some((p) => p.kind === 'chest')) bad.push(`chest ${s.id} follows a chest`);
  }
  for (let r = 0; r < rows - 1; r++) {
    // no two paths cross: for paths a→b and c→d in the same gap, a<c must mean b<=d
    const edges = inRow(r).flatMap((a) => a.next.map((n) => [a.col, t.stops[n].col] as const));
    for (const [a, b] of edges) for (const [c, d] of edges) if (a < c && b > d) bad.push(`paths cross between rows ${r} and ${r + 1}`);
  }
  if (!t.stops.some((s) => s.next.length > 1)) bad.push('no stop offers a choice');
  return [...new Set(bad)];
}
