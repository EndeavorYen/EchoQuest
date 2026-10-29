/** Where creatures live: the ground a wild encounter happens on decides which types turn up. */
export type Habitat = 'meadow' | 'forest' | 'lake' | 'cave';

export type PlaceKey = Habitat | 'gym';

export interface Place {
  zh: string;
  icon: string;
  /** creature types that live here */
  types: string[];
}

export const PLACES: Record<PlaceKey, Place> = {
  meadow: { zh: '草原', icon: '🌾', types: ['normal', 'grass', 'bug', 'flying', 'electric', 'fairy'] },
  forest: { zh: '森林', icon: '🌲', types: ['grass', 'bug', 'poison', 'dark', 'fighting', 'normal'] },
  lake: { zh: '湖邊', icon: '🌊', types: ['water', 'ice', 'flying', 'ground'] },
  cave: { zh: '山洞', icon: '⛰️', types: ['rock', 'ground', 'steel', 'ghost', 'dark', 'poison', 'psychic'] },
  gym: { zh: '道館', icon: '🏛️', types: [] },
};

/** How rare the creatures may be: they get rarer as the party climbs towards the gym (0 at the start, 1 at the gym). */
export function maxRarityAt(progress: number): number {
  return progress < 0.34 ? 2 : progress < 0.75 ? 3 : 4;
}
