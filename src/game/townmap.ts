/**
 * The trek map, in the spirit of the "Town Map" of the Pokémon games: big places (towns, gym cities, caves,
 * forests, islands, special buildings, the league) joined by named roads, with 1-3 small stops on every road.
 * Every map is generated from a seed and the maps differ in size and shape, so there is always a new one.
 *
 * Every stop and every big place except a town holds exactly one wild creature (a boss in a gym city and at the
 * league); once it is beaten it stays beaten. Losing or running away puts the party back on the place it came from.
 */
import { Rng } from '../util/rng';
import { PLACES } from '../mon/habitat';

export type PlaceKind = 'town' | 'city' | 'cave' | 'forest' | 'lake' | 'special' | 'league' | 'wild';
export type RoadKind = 'grass' | 'water' | 'forest' | 'mountain';
export type MapSize = 'S' | 'M' | 'L';
/** Which rarity table a node uses. */
export type Cat = 'small' | 'big' | 'gym' | 'final';

export interface MapNode {
  id: number;
  kind: PlaceKind;
  name: string;
  /** the grid cell at its centre (the map is a grid of square cells, like the handheld Town Maps) */
  col: number;
  row: number;
  /** how many cells wide it is: gym cities and the league are wide (3), everything else is one cell */
  w: number;
  /** the centre of that cell in map units: x across 0..100, y down 0..height (the league is at the top) */
  x: number;
  y: number;
  layer: number;
  /** the road a small stop sits on, -1 for a big place */
  road: number;
  /** the creature types that live here (a gym city or the league: its boss's type) */
  types: string[];
  icon: string;
  /** a present waiting in this town */
  gift: boolean;
}

export interface Road {
  id: number;
  kind: RoadKind;
  name: string;
  a: number;
  b: number;
  /** the small stops between a and b, in order from a */
  nodes: number[];
  /** every grid cell the road passes through, from a to b: it only ever goes north, south, east or west */
  path: [number, number][];
}

export interface TownMap {
  v: 2;
  seed: number;
  size: MapSize;
  title: string;
  layers: number;
  /** drawing height in map units (the width is 100) */
  height: number;
  nodes: MapNode[];
  /** which nodes are next to each other */
  links: [number, number][];
  roads: Road[];
  at: number;
  /** the node being stepped onto while its creature is fought (cleared when the party goes back) */
  entering: number | null;
  /** nodes whose creature has been beaten */
  cleared: number[];
  visited: number[];
  /** nodes whose types are shown (visited ones always are) */
  revealed: number[];
  /** places the party has seen from a neighbouring place (they stay out of the fog); absent in maps saved before fog */
  seen?: number[];
  gifts: number[];
  infoDone: number[];
  quizDone: number[];
  /** the creature rolled for a node, kept so that backing out doesn't re-roll it */
  foes: Record<string, number>;
}

export const TYPE_IDS = ['fire', 'water', 'grass', 'electric', 'bug', 'poison', 'psychic', 'fairy', 'ice', 'flying', 'normal', 'ground', 'rock', 'ghost', 'dark', 'dragon', 'fighting', 'steel'];

/** The map is a grid of COLS columns; a layer (a row of places) is SPACE grid rows apart. */
export const COLS = 9;
export const SPACE = 3;
export const CELL = 100 / COLS;

export const SIZE_NAME: Record<MapSize, string> = { S: '小地圖', M: '中地圖', L: '大地圖' };
/** How many gym cities a map of this size has (the league comes on top of them). */
const GYMS: Record<MapSize, [number, number]> = { S: [0, 1], M: [1, 2], L: [2, 3] };
const SIZE_ODDS: [MapSize, number][] = [['S', 0.35], ['M', 0.45], ['L', 0.2]];

const TOWN_A = ['青草', '白雲', '彩虹', '星光', '月牙', '小橋', '楓葉', '海風', '花香', '金沙', '銀杏', '藍天', '晨曦', '櫻花', '陽光', '紅葉', '竹林', '珊瑚', '雪松', '黃昏', '糖果', '蜜柑', '微風', '麥田'];
const CITY_A = ['華麗', '翡翠', '琥珀', '紫水晶', '黃金', '白銀', '紅寶石', '藍寶石', '珍珠', '鑽石', '彩雲', '光輝'];
const CAVE_A = ['閃閃', '迴音', '水晶', '暗影', '深深', '月光', '礦石', '蝙蝠', '寂靜', '螢火'];
const FOREST_A = ['常青', '迷霧', '蘑菇', '蟲鳴', '松果', '綠蔭', '古樹', '鳥語'];
const LAKE_A = ['鏡', '月光', '天使', '貝殼', '海豚', '珊瑚', '星星', '彩虹'];
const REGION_A = ['彩虹', '星光', '翡翠', '晨曦', '海風', '楓葉', '白雲', '珊瑚', '琥珀', '月光', '花香', '金沙'];

/** Special buildings: each belongs to a few types. */
export const SPECIALS: { zh: string; icon: string; types: string[] }[] = [
  { zh: '發電廠', icon: '🏭', types: ['electric', 'steel'] },
  { zh: '古塔', icon: '🗼', types: ['ghost', 'psychic'] },
  { zh: '遊樂園', icon: '🎡', types: ['fairy', 'normal'] },
  { zh: '武道館', icon: '🥋', types: ['fighting', 'normal'] },
  { zh: '火山', icon: '🌋', types: ['fire', 'rock'] },
  { zh: '雪山小屋', icon: '🏔️', types: ['ice', 'water'] },
  { zh: '龍之谷', icon: '🐉', types: ['dragon', 'flying'] },
  { zh: '廢棄工廠', icon: '🏚️', types: ['poison', 'steel'] },
  { zh: '空中花園', icon: '🌸', types: ['flying', 'grass', 'bug'] },
];

const KIND_ICON: Record<Exclude<PlaceKind, 'special'>, string> = { town: '🏡', city: '🏙️', cave: '⛰️', forest: '🌲', lake: '🏝️', league: '🏆', wild: '' };
export const kindLabel: Record<PlaceKind, string> = { town: '城鎮', city: '道館城市', cave: '山洞', forest: '森林', lake: '湖心島', special: '特殊地點', league: '冠軍聯盟', wild: '路上' };
export const roadIcon: Record<RoadKind, string> = { grass: '🛤️', water: '🌊', forest: '🌲', mountain: '⛰️' };

const ROAD_POOL: Record<RoadKind, string[]> = { grass: PLACES.meadow.types, water: PLACES.lake.types, forest: PLACES.forest.types, mountain: PLACES.cave.types };
const BIG_POOL: Partial<Record<PlaceKind, string[]>> = { cave: PLACES.cave.types, forest: PLACES.forest.types, lake: PLACES.lake.types };

/** Types come out of a shuffled bag so that, map after map, every type turns up. */
class TypeBag {
  private bag: string[] = [];
  constructor(private rng: Rng) {}
  take(pool: readonly string[], not: readonly string[] = []): string {
    if (!this.bag.length) this.bag = this.rng.shuffle(TYPE_IDS);
    const i = this.bag.findIndex((t) => pool.includes(t) && !not.includes(t));
    if (i < 0) {
      const rest = pool.filter((t) => !not.includes(t));
      return this.rng.pick(rest.length ? rest : pool);
    }
    return this.bag.splice(i, 1)[0];
  }
}

function pickName(pool: readonly string[], suffix: string, rng: Rng, used: Set<string>): string {
  const free = pool.filter((x) => !used.has(x + suffix));
  let name = free.length ? free[rng.int(0, free.length - 1)] + suffix : '';
  for (let n = 2; !name || used.has(name); n++) name = `${pool[rng.int(0, pool.length - 1)]}${suffix}${n}`;
  used.add(name);
  return name;
}

const key = (c: number, r: number): string => `${c},${r}`;
const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** The cells a place covers. */
export const footprint = (n: { col: number; row: number; w: number }): [number, number][] => Array.from({ length: n.w }, (_, i) => [n.col - (n.w - 1) / 2 + i, n.row]);
const inFoot = (n: { col: number; row: number; w: number }, c: number, r: number): boolean => r === n.row && Math.abs(c - n.col) <= (n.w - 1) / 2;

/**
 * The shortest road between two places over the grid that goes straight where it can (turns cost extra), never
 * through another place or its doorstep or a road already laid. Returns the cells from a's edge to b's edge, or null.
 */
function routeRoad(a: MapNode, b: MapNode, blocked: (c: number, r: number) => boolean): [number, number][] | null {
  const top = Math.min(a.row, b.row), bottom = Math.max(a.row, b.row);
  type St = { c: number; r: number; d: number; cost: number; prev: St | null };
  const best = new Map<string, number>();
  const open: St[] = footprint(a).map(([c, r]) => ({ c, r, d: -1, cost: 0, prev: null }));
  while (open.length) {
    open.sort((x, y) => x.cost - y.cost);
    const cur = open.shift()!;
    if (inFoot(b, cur.c, cur.r)) {
      const out: [number, number][] = [];
      for (let n: St | null = cur; n; n = n.prev) out.unshift([n.c, n.r]);
      return out;
    }
    const k = `${key(cur.c, cur.r)}/${cur.d}`;
    if ((best.get(k) ?? Infinity) <= cur.cost) continue;
    best.set(k, cur.cost);
    DIRS.forEach(([dc, dr], d) => {
      const c = cur.c + dc, r = cur.r + dr;
      if (c < 0 || c >= COLS || r < top || r > bottom || inFoot(a, c, r)) return;
      const isEnd = inFoot(b, c, r);
      if (!isEnd && blocked(c, r)) return;
      // a road likes to leave a place by its north door and arrive at the next by its south door; the side doors are for the others
      const side = a.row !== b.row && ((cur.prev === null && d !== 0) || (isEnd && d !== 0)) ? 4 : 0;
      open.push({ c, r, d, cost: cur.cost + 1 + (cur.d >= 0 && cur.d !== d ? 3 : 0) + side, prev: cur });
    });
  }
  return null;
}

function layout(rng: Rng, sz: MapSize, gyms: number, bag: TypeBag, used: Set<string>): TownMap | null {
  // layers from the bottom: the start town; per segment a row of two wild places and then a city (the league at the end)
  const plan: { kind: 'start' | 'wild' | 'city' | 'league'; width: number }[] = [{ kind: 'start', width: 1 }];
  for (let s = 0; s <= gyms; s++) {
    plan.push({ kind: 'wild', width: 2 });
    plan.push({ kind: s === gyms ? 'league' : 'city', width: 1 });
  }
  const layers = plan.length;
  const rows = (layers - 1) * SPACE + 3;
  const height = rows * CELL;
  const rowOf = (layer: number): number => (layers - 1 - layer) * SPACE + 1;

  const nodes: MapNode[] = [];
  const byLayer: MapNode[][] = [];
  const mk = (kind: PlaceKind, layer: number, col: number, row: number, road = -1): MapNode => {
    const n: MapNode = { id: nodes.length, kind, name: '', col, row, w: kind === 'city' || kind === 'league' ? 3 : 1, x: Math.round((col + 0.5) * CELL * 10) / 10, y: Math.round((row + 0.5) * CELL * 10) / 10, layer, road, types: [], icon: '', gift: false };
    nodes.push(n);
    return n;
  };
  plan.forEach((p, layer) => {
    byLayer.push([]);
    const cols = p.width === 1 ? [rng.int(3, 5)] : [rng.int(1, 2), rng.int(6, 7)];
    for (const c of cols) byLayer[layer].push(mk(p.kind === 'start' || p.kind === 'wild' ? 'town' : p.kind, layer, c, rowOf(layer)));
  });

  // what the wild places are: a mix, never all the same in a row, and some towns
  const wildLayers = plan.map((p, i) => (p.kind === 'wild' ? i : -1)).filter((i) => i >= 0);
  for (const l of wildLayers) {
    const row = byLayer[l];
    const kinds: PlaceKind[] = row.map(() => {
      const r = rng.next();
      return r < 0.2 ? 'town' : r < 0.4 ? 'cave' : r < 0.58 ? 'forest' : r < 0.74 ? 'lake' : 'special';
    });
    if (new Set(kinds).size === 1) kinds[rng.int(0, kinds.length - 1)] = kinds[0] === 'special' ? 'cave' : 'special';
    row.forEach((p, i) => { p.kind = kinds[i]; });
  }
  const wildBig = wildLayers.flatMap((l) => byLayer[l]);
  const wantTowns = Math.max(1, Math.ceil(wildLayers.length / 2));
  while (wildBig.filter((p) => p.kind === 'town').length < wantTowns) {
    const cand = wildBig.filter((p) => p.kind !== 'town');
    cand[rng.int(0, cand.length - 1)].kind = 'town';
  }
  for (const l of wildLayers) {
    const row = byLayer[l];
    if (row.every((p) => p.kind === 'town')) row[rng.int(0, row.length - 1)].kind = 'cave';
  }

  // names, themes, icons, gifts
  const specials = rng.shuffle(SPECIALS);
  let sp = 0;
  for (const p of nodes) {
    if (p.kind !== 'special') p.icon = KIND_ICON[p.kind];
    if (p.layer === 0) p.name = pickName(TOWN_A, '鎮', rng, used);
    else if (p.kind === 'league') p.name = '冠軍聯盟';
    else if (p.kind === 'city') p.name = pickName(CITY_A, '市', rng, used);
    else if (p.kind === 'cave') p.name = pickName(CAVE_A, '洞窟', rng, used);
    else if (p.kind === 'forest') p.name = pickName(FOREST_A, '森林', rng, used);
    else if (p.kind === 'lake') p.name = pickName(LAKE_A, '島', rng, used);
    else if (p.kind === 'special') {
      const s = specials[sp++ % specials.length];
      p.name = used.has(s.zh) ? `${s.zh}${sp}` : s.zh;
      used.add(p.name);
      p.icon = s.icon;
      p.types = s.types.length > 1 && rng.chance(0.5) ? [s.types[rng.int(0, 1)]] : [...s.types];
    } else p.name = pickName(TOWN_A, rng.chance(0.5) ? '鎮' : '村', rng, used);
    if (p.kind === 'cave' || p.kind === 'forest' || p.kind === 'lake') {
      const a = bag.take(BIG_POOL[p.kind]!);
      p.types = rng.chance(0.7) ? [a, bag.take(BIG_POOL[p.kind]!, [a])] : [a];
    }
    if (p.kind === 'city' || p.kind === 'league') p.types = [bag.take(TYPE_IDS)];
  }
  const giftTowns = nodes.filter((p) => p.kind === 'town' && p.layer > 0);
  for (const t of giftTowns) t.gift = rng.chance(0.7);
  if (giftTowns.length && !giftTowns.some((t) => t.gift)) giftTowns[rng.int(0, giftTowns.length - 1)].gift = true;

  // which places are joined: a staircase through each two rows, so nothing is left out and nothing needs to cross
  const pairs: [MapNode, MapNode][] = [];
  const seen = new Set<string>();
  const link = (a: MapNode, b: MapNode): void => {
    const k = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (!seen.has(k)) { seen.add(k); pairs.push([a, b]); }
  };
  for (let l = 0; l < layers - 1; l++) {
    const a = byLayer[l], b = byLayer[l + 1];
    let i = 0, j = 0;
    link(a[i], b[j]);
    while (i < a.length - 1 || j < b.length - 1) {
      if (i === a.length - 1) j++;
      else if (j === b.length - 1) i++;
      else {
        const x = rng.next();
        if (x < 0.34) i++; else if (x < 0.68) j++; else { i++; j++; }
      }
      link(a[i], b[j]);
    }
  }
  const sides: [MapNode, MapNode][] = [];
  for (const l of wildLayers) if (rng.chance(0.3)) sides.push([byLayer[l][0], byLayer[l][1]]);

  // lay the roads on the grid: places and their doorsteps are off limits to other roads, and so are cells already used
  const cellOwner = new Map<string, Set<number>>();
  const own = (c: number, r: number, id: number): void => { (cellOwner.get(key(c, r)) ?? cellOwner.set(key(c, r), new Set()).get(key(c, r))!).add(id); };
  for (const n of nodes) for (const [c, r] of footprint(n)) { own(c, r, n.id); for (const [dc, dr] of DIRS) own(c + dc, r + dr, n.id); }
  const taken = new Set<string>();
  const laid: { a: MapNode; b: MapNode; path: [number, number][] }[] = [];
  for (const [a, b] of [...pairs, ...sides]) {
    const optional = sides.some(([x, y]) => x === a && y === b);
    const path = routeRoad(a, b, (c, r) => {
      if (taken.has(key(c, r))) return true;
      const owners = cellOwner.get(key(c, r));
      return !!owners && [...owners].some((id) => id !== a.id && id !== b.id);
    });
    if (!path || path.length < 3) { if (optional) continue; return null; }
    for (const [c, r] of path.slice(1, -1)) taken.add(key(c, r));
    laid.push({ a, b, path });
  }

  const links: [number, number][] = [];
  const roads: Road[] = laid.map(({ a, b, path }, id) => {
    const ends = [a.kind, b.kind];
    const kind: RoadKind = ends.includes('lake') ? 'water' : ends.includes('cave') ? 'mountain' : ends.includes('forest') ? 'forest' : 'grass';
    const interior = path.length - 2;
    const r = rng.next();
    const k = Math.min(interior, r < 0.7 ? 1 : 2);
    const idx = new Set<number>();
    for (let i = 1; i <= k; i++) idx.add(Math.max(1, Math.min(path.length - 2, Math.round((i * (path.length - 1)) / (k + 1)))));
    const road = `${id + 1}號${kind === 'grass' ? '道路' : kind === 'water' ? '水路' : kind === 'forest' ? '森林小徑' : '山路'}`;
    const stops: MapNode[] = [...idx].sort((x, y) => x - y).map((i) => {
      const s = mk('wild', Math.min(a.layer, b.layer), path[i][0], path[i][1], id);
      s.name = road;
      s.types = [bag.take(ROAD_POOL[kind])];
      return s;
    });
    const chain = [a, ...stops, b];
    for (let i = 0; i < chain.length - 1; i++) links.push([chain[i].id, chain[i + 1].id]);
    return { id, a: a.id, b: b.id, kind, name: road, nodes: stops.map((x) => x.id), path };
  });

  return {
    v: 2, seed: 0, size: sz, title: '', layers, height, nodes, links, roads,
    at: 0, entering: null, cleared: [], visited: [0], revealed: [], gifts: [], infoDone: [], quizDone: [], foes: {},
  };
}

export function generateTownMap(seed: number, size?: MapSize): TownMap {
  const rng = new Rng(seed);
  const sz: MapSize = size ?? ((): MapSize => {
    let r = rng.next();
    for (const [s, p] of SIZE_ODDS) { if (r < p) return s; r -= p; }
    return 'S';
  })();
  const gyms = rng.int(GYMS[sz][0], GYMS[sz][1]);
  // the places are scattered at random and the roads laid on them; if they will not fit, try another scatter
  for (let attempt = 0; attempt < 200; attempt++) {
    const m = layout(rng, sz, gyms, new TypeBag(rng), new Set());
    if (m) return { ...m, seed, title: pickName(REGION_A, '地區', rng, new Set()) };
  }
  throw new Error(`no town map fits for seed ${seed}`);
}

// ---- walking ------------------------------------------------------------------

const ADJ = new WeakMap<object, Map<number, number[]>>();
function adjacency(m: TownMap): Map<number, number[]> {
  let a = ADJ.get(m.links);
  if (!a) {
    a = new Map();
    for (const [x, y] of m.links) {
      (a.get(x) ?? a.set(x, []).get(x)!).push(y);
      (a.get(y) ?? a.set(y, []).get(y)!).push(x);
    }
    ADJ.set(m.links, a);
  }
  return a;
}
export const neighbors = (m: TownMap, id: number): number[] => adjacency(m).get(id) ?? [];

export const isBig = (n: MapNode): boolean => n.kind !== 'wild';
/** Is there a creature to beat before the party can stand here? (Towns have none.) */
export const needsFight = (m: TownMap, id: number): boolean => m.nodes[id].kind !== 'town' && !m.cleared.includes(id);
export const isRevealed = (m: TownMap, id: number): boolean => m.visited.includes(id) || m.revealed.includes(id);

export function catOf(n: MapNode): Cat {
  return n.kind === 'wild' ? 'small' : n.kind === 'city' ? 'gym' : n.kind === 'league' ? 'final' : 'big';
}

/** Chances of ★1…★5 for each kind of node. */
export const RARITY_TABLE: Record<Cat, [number, number, number, number, number]> = {
  small: [0.40, 0.35, 0.24, 0.01, 0],
  big: [0, 0.30, 0.50, 0.18, 0.02],
  gym: [0, 0, 0.65, 0.35, 0],
  final: [0, 0, 0, 0.70, 0.30],
};

/** Roll a rarity; the further up the map (`progress` 0..1), the more the odds lean to the rarer ones. */
export function rollRarity(rng: Rng, cat: Cat, progress: number): number {
  const w = RARITY_TABLE[cat].map((p, i) => p * Math.exp((i - 2) * Math.max(0, Math.min(1, progress)) * 0.6));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return i + 1; }
  for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i + 1;
  return 1;
}

export const progressOf = (m: TownMap, n: MapNode): number => n.layer / Math.max(1, m.layers - 1);

/** Step towards a neighbour that has a creature to beat. */
export function startEntering(m: TownMap, id: number): TownMap {
  return neighbors(m, m.at).includes(id) && needsFight(m, id) ? { ...m, entering: id } : m;
}
/** Walk onto a neighbour that has nothing to fight (a town, or a place already cleared). */
export function moveTo(m: TownMap, id: number): TownMap {
  return neighbors(m, m.at).includes(id) && !needsFight(m, id) ? markSeen({ ...m, at: id, entering: null, visited: m.visited.includes(id) ? m.visited : [...m.visited, id] }) : m;
}
/** The creature of the node being entered was beaten. */
export function winEntering(m: TownMap): TownMap {
  const id = m.entering;
  if (id === null) return m;
  return markSeen({
    ...m, at: id, entering: null,
    cleared: m.cleared.includes(id) ? m.cleared : [...m.cleared, id],
    visited: m.visited.includes(id) ? m.visited : [...m.visited, id],
  });
}
/** Lost, ran away or backed out: the party is where it was, and what it has beaten stays beaten. */
export const retreat = (m: TownMap): TownMap => (m.entering === null ? m : { ...m, entering: null });
export const rememberFoe = (m: TownMap, id: number, mon: number): TownMap => ({ ...m, foes: { ...m.foes, [id]: mon } });

// ---- fog ----------------------------------------------------------------------

/** Remember the places next to where the party stands: once seen, they stay out of the fog. */
function markSeen(m: TownMap): TownMap {
  const seen = new Set([...(m.seen ?? []), ...neighbors(m, m.at)]);
  return seen.size === (m.seen ?? []).length ? m : { ...m, seen: [...seen] };
}

/** The places that are not under clouds: where the party has been, what it has seen next door, what the town news lifted, and the league. */
export function visibleNodes(m: TownMap): Set<number> {
  const v = new Set<number>([m.at, ...m.visited, ...m.revealed, ...(m.seen ?? []), ...neighbors(m, m.at)]);
  const league = m.nodes.find((n) => n.kind === 'league');
  if (league) v.add(league.id);
  return v;
}

/** The grid cells with no cloud over them: the visible places and the stretches of road between two visible places. */
export function clearCells(m: TownMap): Set<string> {
  const v = visibleNodes(m);
  const out = new Set<string>();
  for (const id of v) {
    const n = m.nodes[id];
    const halo = n.kind === 'wild' ? 0 : 1;
    for (const [c, r] of footprint(n)) for (let dc = -halo; dc <= halo; dc++) for (let dr = -halo; dr <= halo; dr++) out.add(key(c + dc, r + dr));
  }
  for (const road of m.roads) {
    const chain = [road.a, ...road.nodes, road.b];
    const at = chain.map((id, i) => (i === 0 ? 0 : i === chain.length - 1 ? road.path.length - 1 : road.path.findIndex(([c, r]) => c === m.nodes[id].col && r === m.nodes[id].row)));
    for (let i = 0; i < chain.length - 1; i++) {
      if (v.has(chain[i]) && v.has(chain[i + 1])) for (let k = at[i]; k <= at[i + 1]; k++) out.add(key(road.path[k][0], road.path[k][1]));
    }
  }
  return out;
}

// ---- towns ---------------------------------------------------------------------

export const atTown = (m: TownMap): boolean => m.nodes[m.at].kind === 'town';
export const canGift = (m: TownMap): boolean => atTown(m) && m.nodes[m.at].gift && !m.gifts.includes(m.at);
export const canInfo = (m: TownMap): boolean => atTown(m) && !m.infoDone.includes(m.at);
export const canQuiz = (m: TownMap): boolean => atTown(m) && !m.quizDone.includes(m.at);
export const takeGift = (m: TownMap): TownMap => (canGift(m) ? { ...m, gifts: [...m.gifts, m.at] } : m);
export const doneQuiz = (m: TownMap): TownMap => (canQuiz(m) ? { ...m, quizDone: [...m.quizDone, m.at] } : m);

/** How many steps along the roads each node is from a place. */
export function hopsFrom(m: TownMap, from: number): Map<number, number> {
  const d = new Map<number, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of neighbors(m, cur)) if (!d.has(n)) { d.set(n, d.get(cur)! + 1); q.push(n); }
  }
  return d;
}
export const INFO_HOPS = 5;
/** The town's news: which creatures live in the places around it. */
export function useInfo(m: TownMap): TownMap {
  if (!canInfo(m)) return m;
  const near = [...hopsFrom(m, m.at)].filter(([, h]) => h <= INFO_HOPS).map(([id]) => id);
  return { ...m, infoDone: [...m.infoDone, m.at], revealed: [...new Set([...m.revealed, ...near])] };
}

export function isTownMap(x: unknown): x is TownMap {
  const m = x as TownMap | null;
  return (
    !!m && typeof m === 'object' && m.v === 2 && Array.isArray(m.nodes) && Array.isArray(m.links) && Array.isArray(m.roads) && m.nodes.length > 3 &&
    Number.isInteger(m.at) && m.at >= 0 && m.at < m.nodes.length && typeof m.height === 'number' && !!m.foes &&
    ['cleared', 'visited', 'revealed', 'gifts', 'infoDone', 'quizDone'].every((k) => Array.isArray((m as unknown as Record<string, unknown>)[k])) &&
    m.nodes.every((n) => n && typeof n.x === 'number' && typeof n.w === 'number' && Array.isArray(n.types)) &&
    m.roads.every((r) => r && Array.isArray(r.path) && r.path.length > 2) &&
    m.links.every((l) => Array.isArray(l) && m.nodes[l[0]] && m.nodes[l[1]]) &&
    (m.entering === null || !!m.nodes[m.entering])
  );
}

/** The rules every generated map must obey; returns the ones that are broken. */
export function checkTownMap(m: TownMap): string[] {
  const bad: string[] = [];
  const big = m.nodes.filter(isBig);
  const starts = big.filter((p) => p.layer === 0);
  if (starts.length !== 1 || starts[0].kind !== 'town' || m.at !== starts[0].id) bad.push('one start town where the party stands');
  const leagues = big.filter((p) => p.kind === 'league');
  if (leagues.length !== 1 || leagues[0].layer !== m.layers - 1) bad.push('exactly one league, on the top layer');
  const cities = big.filter((p) => p.kind === 'city');
  if (cities.length < GYMS[m.size][0] || cities.length > GYMS[m.size][1]) bad.push(`a ${m.size} map has ${GYMS[m.size].join('-')} gym cities`);
  if (new Set(m.nodes.filter(isBig).map((p) => p.name)).size !== big.length) bad.push('place names must be different');
  if (new Set(m.roads.map((r) => r.name)).size !== m.roads.length) bad.push('road names must be different');
  if (!m.nodes.every((n) => (n.kind === 'town' ? n.types.length === 0 : n.types.length >= 1 && n.types.every((t) => TYPE_IDS.includes(t))))) bad.push('every place with a creature has types, towns have none');
  // every node can be reached from the start
  if (hopsFrom(m, m.at).size !== m.nodes.length) bad.push('some places cannot be reached');
  // every road has 1-2 stops, all in a line between its ends
  for (const r of m.roads) {
    if (r.nodes.length < 1 || r.nodes.length > 2) bad.push(`road ${r.name} needs 1-2 stops`);
    const chain = [r.a, ...r.nodes, r.b];
    for (let i = 0; i < chain.length - 1; i++) if (!neighbors(m, chain[i]).includes(chain[i + 1])) bad.push(`road ${r.name} is broken`);
    for (const id of r.nodes) if (m.nodes[id].road !== r.id || neighbors(m, id).length !== 2) bad.push(`stop on road ${r.name} is misplaced`);
  }
  // roads join neighbouring rows (or neighbours in one row)
  for (const r of m.roads) {
    const a = m.nodes[r.a], b = m.nodes[r.b];
    const d = Math.abs(a.layer - b.layer);
    if (d > 1) bad.push(`road ${r.name} skips a row`);
    if (d === 0 && (a.kind === 'city' || a.kind === 'league')) bad.push('no side roads at a gym city');
  }
  // gym cities are bottlenecks: take one away and the league cannot be reached
  for (const c of cities) {
    const seenIds = new Set([m.at]);
    const q = [m.at];
    while (q.length) for (const n of neighbors(m, q.pop()!)) if (n !== c.id && !seenIds.has(n)) { seenIds.add(n); q.push(n); }
    if (seenIds.has(leagues[0]?.id)) bad.push(`the way to the league avoids ${c.name}`);
  }
  // the way forks: two roads leave the start, and every row of wild places has a choice of at least two
  if (m.roads.filter((r) => r.a === m.at || r.b === m.at).length < 2) bad.push('the start town has one road only');
  for (let l = 1; l < m.layers - 1; l++) {
    const row = big.filter((p) => p.layer === l);
    if (row.length === 1 && row[0].kind !== 'city') bad.push(`row ${l} is a single place`);
  }
  if (!big.some((p) => p.kind === 'town' && p.layer > 0)) bad.push('at least one town besides the start');
  if (!big.some((p) => p.gift)) bad.push('at least one gift');
  // the roads are drawn on the grid: they only go north, south, east or west, and never share a cell
  const cells = new Set<string>();
  for (const r of m.roads) {
    r.path.forEach(([c, row], i) => {
      if (i > 0 && Math.abs(c - r.path[i - 1][0]) + Math.abs(row - r.path[i - 1][1]) !== 1) bad.push(`road ${r.name} turns a corner diagonally`);
      if (i > 0 && i < r.path.length - 1) {
        if (cells.has(`${c},${row}`)) bad.push(`roads share a cell near ${r.name}`);
        cells.add(`${c},${row}`);
      }
    });
  }
  const spot = new Set<string>();
  for (const n of m.nodes) for (const [c, r] of footprint(n)) {
    if (spot.has(`${c},${r}`)) bad.push('two places in one cell');
    spot.add(`${c},${r}`);
    if (c < 0 || c >= COLS) bad.push('a place is off the map');
  }
  for (const r of m.roads) {
    const [first, last] = [r.path[0], r.path[r.path.length - 1]];
    if (!inFoot(m.nodes[r.a], first[0], first[1]) || !inFoot(m.nodes[r.b], last[0], last[1])) bad.push(`road ${r.name} does not start and end at its places`);
    for (const id of r.nodes) if (!r.path.some(([c, row]) => c === m.nodes[id].col && row === m.nodes[id].row)) bad.push(`a stop is off road ${r.name}`);
  }
  if (m.nodes.some((n) => neighbors(m, n.id).length > 4)) bad.push('a place with more than four roads');
  return [...new Set(bad)];
}

/** The fewest creatures any way from the start to the league meets, the league's boss included. */
export function fewestFights(m: TownMap): number {
  const best = new Map<number, number>([[m.at, 0]]);
  const q = [m.at];
  while (q.length) {
    q.sort((a, b) => (best.get(a) ?? 0) - (best.get(b) ?? 0));
    const cur = q.shift()!;
    for (const to of neighbors(m, cur)) {
      const c = (best.get(cur) ?? 0) + (m.nodes[to].kind === 'town' ? 0 : 1);
      if (c < (best.get(to) ?? Infinity)) { best.set(to, c); q.push(to); }
    }
  }
  return best.get(m.nodes.find((p) => p.kind === 'league')!.id) ?? Infinity;
}
