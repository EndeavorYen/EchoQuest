import evolutions from '../data/mon/evolutions.json';

export type EvoMap = Record<string, { from?: number; to?: number[] }>;
export const EVO = evolutions as EvoMap;

export interface EvoNode {
  id: number;
  kids: EvoNode[];
}

/**
 * The whole family a creature belongs to, from the first stage down, as a tree
 * (Eevee has many branches). Null when the creature has no relatives at all.
 */
export function evoTree(id: number, evo: EvoMap = EVO): EvoNode | null {
  let root = id;
  const climbed = new Set<number>([root]);
  while (evo[root]?.from && !climbed.has(evo[root]!.from!)) {
    root = evo[root]!.from!;
    climbed.add(root);
  }
  const grow = (n: number, seen: Set<number>): EvoNode => ({
    id: n,
    kids: (evo[n]?.to ?? []).filter((k) => !seen.has(k)).map((k) => grow(k, new Set([...seen, k]))),
  });
  const tree = grow(root, new Set([root]));
  return tree.kids.length ? tree : null;
}

/** One page of a list; the page number is kept inside the real range. */
export function paginate<T>(list: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(pages - 1, Math.max(0, page));
  return { items: list.slice(p * size, (p + 1) * size), page: p, pages };
}
