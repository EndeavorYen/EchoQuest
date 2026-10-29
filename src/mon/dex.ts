/**
 * The creature roster, loaded from data files copied out of colormon
 * (`src/data/mon/`): names, types, rarity and signature colours. No images live
 * in this repo — they are fetched at run time from the URLs in config.json.
 */
import config from '../data/mon/config.json';
import typeTable from '../data/mon/types.json';
import { Rng } from '../util/rng';

export type MonType = keyof typeof typeTable;

export interface TypeInfo {
  name: string;
  color: string;
  glyph: string;
  fx: { style: string; colors: string[] };
  arena: { base: string[]; frame: string };
}

export interface Mon {
  id: number;
  name: string;
  type: string;
  /** 1–5 stars; 5 is very rare */
  rarity: number;
  colors: string[];
}

interface PackFile {
  name?: string;
  pokemon: Array<Partial<Mon> & { id: number }>;
}

export const TYPES = typeTable as unknown as Record<string, TypeInfo>;

/** Merge the pack files: full entries add creatures, partial ones (colour tweaks) patch them. */
export function buildDex(packs: PackFile[]): Mon[] {
  const byId = new Map<number, Mon>();
  for (const pack of packs) {
    for (const e of pack.pokemon ?? []) {
      const have = byId.get(e.id);
      if (have) Object.assign(have, e);
      else if (e.name && e.type && e.rarity && e.colors) byId.set(e.id, { id: e.id, name: e.name, type: e.type, rarity: e.rarity, colors: e.colors });
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

const files = import.meta.glob<PackFile>('../data/mon/packs/*.json', { eager: true, import: 'default' });
// generation packs first, tweaks last
const ordered = Object.entries(files)
  .sort(([a], [b]) => (a.includes('tweaks') ? 1 : b.includes('tweaks') ? -1 : a.localeCompare(b)))
  .map(([, v]) => v);

export const DEX: Mon[] = buildDex(ordered);
export const MON_BY_ID = new Map(DEX.map((m) => [m.id, m]));

const fill = (tpl: string, id: number): string => tpl.replace('{id}', String(id));
/** Official artwork (large, smooth) */
export const artUrl = (id: number): string => fill(config.artUrl, id);
/** Small front sprite */
export const spriteUrl = (id: number): string => fill(config.spriteUrl, id);
/** Small back sprite — the partner seen from behind */
export const backSpriteUrl = (id: number): string => fill(config.backSpriteUrl, id);

export function typeOf(m: Mon): TypeInfo {
  return TYPES[m.type] ?? TYPES.normal;
}

/** How many shield layers a wild creature of this rarity carries (3★+). */
export function shieldLayers(m: Mon): number {
  return (config.shields as Record<string, number>)[String(m.rarity)] ?? 0;
}

const RARITY_WEIGHT = config.rarityWeight as Record<string, number>;

/** A random creature, common ones far more often than rare ones. `owned` creatures show up a bit less. */
export function pickWild(rng: Rng, opts: { owned?: Set<number>; ownedWeight?: number; maxRarity?: number } = {}): Mon {
  const pool = DEX.filter((m) => m.rarity <= (opts.maxRarity ?? 5));
  const w = pool.map((m) => (RARITY_WEIGHT[String(m.rarity)] ?? 0.1) * (opts.owned?.has(m.id) ? (opts.ownedWeight ?? 0.3) : 1));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** A friendly starter for a new player: common, and of varied types. */
export function starterFor(index: number): Mon {
  const ids = [25, 1, 4, 7, 133, 39]; // a fixed, kid-friendly rotation of well-known commons
  return MON_BY_ID.get(ids[index % ids.length]) ?? DEX[0];
}
