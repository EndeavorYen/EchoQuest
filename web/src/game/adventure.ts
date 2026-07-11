import type { LearnerProfile } from './challenges';
import { getTopReviewCandidates, type LearningProgressState } from '../learning/progress';
import type { VocabItem } from '../types/vocab';

export type BossIntent = 'thorns' | 'falling_branch' | 'curse';
export type Spell = 'fire' | 'shield' | 'heal';
export type MissionEventKind = 'scout' | 'build' | 'escort' | 'evade' | 'boss';

export type MissionEvent = {
  id: string;
  kind: MissionEventKind;
  wordId?: string;
  bossTurns?: Array<{ intent: BossIntent; spell: Spell; wordId: string }>;
};

export type AdventureState = {
  version: 2;
  seed: number;
  events: MissionEvent[];
  eventIndex: number;
  bossTurn: number;
  spellReady: boolean;
  completedEventIds: string[];
  rescued: boolean;
  rewards: string[];
  modesUsed: LearnerProfile[];
};

export type CreateAdventureOptions = {
  seed: number;
  vocab: VocabItem[];
  progress: LearningProgressState;
  now: number;
  recentWordIds?: string[];
};

const BOSS_TURNS: Array<{ intent: BossIntent; spell: Spell }> = [
  { intent: 'thorns', spell: 'fire' },
  { intent: 'falling_branch', spell: 'shield' },
  { intent: 'curse', spell: 'heal' },
];

const BOSS_HINTS: Record<BossIntent, string> = {
  thorns: '荊棘怕火焰。',
  falling_branch: '用護盾擋住落下的樹枝。',
  curse: '治療魔法可以解除詛咒。',
};

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function sortWords(words: VocabItem[]): VocabItem[] {
  return [...words].sort((left, right) => left.id.localeCompare(right.id) || left.word.localeCompare(right.word));
}

function getMissionWordSelection({
  vocab,
  progress,
  now,
  recentWordIds = [],
  random,
}: CreateAdventureOptions & { random: () => number }): string[] {
  const enabledWords = sortWords(vocab.filter((word) => word.enabled));
  const reviewIds = new Set(getTopReviewCandidates(enabledWords, progress, now).map((word) => word.id));
  const recentIds = new Set(recentWordIds);
  const reviewWords = enabledWords.filter((word) => reviewIds.has(word.id));
  const fallbackWords = enabledWords.filter((word) => !reviewIds.has(word.id));
  const prioritisedWords = [
    ...shuffle(reviewWords.filter((word) => !recentIds.has(word.id)), random),
    ...shuffle(fallbackWords.filter((word) => !recentIds.has(word.id)), random),
    ...shuffle(reviewWords.filter((word) => recentIds.has(word.id)), random),
    ...shuffle(fallbackWords.filter((word) => recentIds.has(word.id)), random),
  ];
  const uniqueIds = [...new Set(prioritisedWords.map((word) => word.id))];

  if (uniqueIds.length === 0) {
    throw new Error('A relay mission requires at least one enabled word.');
  }

  return Array.from({ length: 6 }, (_, index) => uniqueIds[index % uniqueIds.length]);
}

export function createAdventure(options: CreateAdventureOptions): AdventureState {
  const random = createSeededRandom(options.seed);
  const eventKinds = shuffle<MissionEventKind>(['scout', 'evade', 'escort', 'build'], random).slice(0, 3);
  const wordIds = getMissionWordSelection({ ...options, random });
  const events: MissionEvent[] = eventKinds.map((kind, index) => ({
    id: `${kind}-${index}`,
    kind,
    wordId: wordIds[index],
  }));

  events.push({
    id: 'boss',
    kind: 'boss',
    bossTurns: BOSS_TURNS.map((turn, index) => ({ ...turn, wordId: wordIds[index + 3] })),
  });

  return {
    version: 2,
    seed: options.seed,
    events,
    eventIndex: 0,
    bossTurn: 0,
    spellReady: false,
    completedEventIds: [],
    rescued: false,
    rewards: [],
    modesUsed: [],
  };
}

export function getCurrentEvent(state: AdventureState): MissionEvent | undefined {
  return state.events[state.eventIndex];
}

export function getCurrentWordId(state: AdventureState): string | undefined {
  const event = getCurrentEvent(state);
  if (!event) return undefined;
  if (event.kind !== 'boss') return event.wordId;
  return event.bossTurns?.[state.bossTurn]?.wordId;
}

export function completeChallenge(state: AdventureState): AdventureState {
  const event = getCurrentEvent(state);
  if (!event || state.rescued) return state;

  if (event.kind === 'boss') {
    return state.spellReady ? state : { ...state, spellReady: true };
  }

  return state.completedEventIds.includes(event.id)
    ? state
    : { ...state, completedEventIds: [...state.completedEventIds, event.id] };
}

export function advanceEvent(state: AdventureState): AdventureState {
  const event = getCurrentEvent(state);
  if (!event || event.kind === 'boss' || !state.completedEventIds.includes(event.id)) return state;

  return { ...state, eventIndex: state.eventIndex + 1 };
}

export function castSpell(state: AdventureState, spell: Spell): { state: AdventureState; correct: boolean; hint: string } {
  const event = getCurrentEvent(state);
  const turn = event?.kind === 'boss' ? event.bossTurns?.[state.bossTurn] : undefined;

  if (!event || event.kind !== 'boss' || !turn || !state.spellReady || spell !== turn.spell) {
    return { state, correct: false, hint: turn ? BOSS_HINTS[turn.intent] : '' };
  }

  const bossTurn = state.bossTurn + 1;
  if (bossTurn === event.bossTurns?.length) {
    return {
      state: {
        ...state,
        bossTurn,
        spellReady: false,
        rescued: true,
        rewards: state.rewards.includes('forest-wizard') ? state.rewards : [...state.rewards, 'forest-wizard'],
      },
      correct: true,
      hint: '',
    };
  }

  return { state: { ...state, bossTurn, spellReady: false }, correct: true, hint: '' };
}

export function recordMissionProfile(state: AdventureState, profile: LearnerProfile): AdventureState {
  return state.modesUsed.includes(profile)
    ? state
    : { ...state, modesUsed: [...state.modesUsed, profile] };
}

export function getMissionWordIds(state: AdventureState): string[] {
  return state.events.flatMap((event) => event.kind === 'boss'
    ? event.bossTurns?.map((turn) => turn.wordId) ?? []
    : event.wordId ? [event.wordId] : []);
}

function getRepairWordId({
  replacementIds,
  replacementIndex,
  enabledIds,
  usedIds,
}: {
  replacementIds: string[];
  replacementIndex: number;
  enabledIds: string[];
  usedIds: Set<string>;
}): string {
  const candidates = [replacementIds[replacementIndex], ...replacementIds, ...enabledIds];
  const replacement = candidates.find((wordId) => wordId && !usedIds.has(wordId))
    ?? candidates.find((wordId) => wordId);

  if (!replacement) {
    throw new Error('A relay mission requires at least one enabled word.');
  }

  usedIds.add(replacement);
  return replacement;
}

export function repairAdventureWords(
  state: AdventureState,
  vocab: VocabItem[],
  progress: LearningProgressState,
  now: number,
): AdventureState {
  const enabledIds = sortWords(vocab.filter((word) => word.enabled)).map((word) => word.id);
  const enabledIdSet = new Set(enabledIds);
  const replacementIds = getMissionWordIds(createAdventure({ seed: state.seed, vocab, progress, now }));
  const usedIds = new Set(getMissionWordIds(state).filter((wordId) => enabledIdSet.has(wordId)));
  let changed = false;
  let wordIndex = 0;

  const events = state.events.map((event) => {
    if (event.kind !== 'boss') {
      const wordId = event.wordId;
      const nextWordId = wordId && enabledIdSet.has(wordId)
        ? wordId
        : getRepairWordId({ replacementIds, replacementIndex: wordIndex, enabledIds, usedIds });
      wordIndex += 1;
      if (nextWordId === wordId) return event;
      changed = true;
      return { ...event, wordId: nextWordId };
    }

    let bossChanged = false;
    const bossTurns = event.bossTurns?.map((turn) => {
      const nextWordId = enabledIdSet.has(turn.wordId)
        ? turn.wordId
        : getRepairWordId({ replacementIds, replacementIndex: wordIndex, enabledIds, usedIds });
      wordIndex += 1;
      if (nextWordId === turn.wordId) return turn;
      changed = true;
      bossChanged = true;
      return { ...turn, wordId: nextWordId };
    });

    return bossChanged ? { ...event, bossTurns } : event;
  });

  return changed ? { ...state, events } : state;
}
