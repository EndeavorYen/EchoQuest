import type {
  AdventureState,
  BossIntent,
  MissionEvent,
  MissionEventKind,
  Spell,
} from '../game/adventure';
import type { LearnerProfile } from '../game/challenges';

export const STORAGE_KEY_ADVENTURE = 'echoquest_adventure_v2';

const VALID_EVENT_KINDS = new Set<MissionEventKind>(['scout', 'build', 'escort', 'evade', 'boss']);
const VALID_BOSS_INTENTS = new Set<BossIntent>(['thorns', 'falling_branch', 'curse']);
const VALID_SPELLS = new Set<Spell>(['fire', 'shield', 'heal']);
const VALID_PROFILES = new Set<LearnerProfile>(['toddler', 'kid', 'adult']);
const VALID_ROOMS = new Set<AdventureState['room']>(['orchard', 'bridge', 'rescue', 'complete']);
const ADVENTURE_KEYS = new Set([
  'version',
  'seed',
  'events',
  'eventIndex',
  'bossTurn',
  'spellReady',
  'completedEventIds',
  'rescued',
  'rewards',
  'modesUsed',
  'room',
  'legacyRoomFlow',
]);
const NON_BOSS_EVENT_KEYS = new Set(['id', 'kind', 'wordId']);
const BOSS_EVENT_KEYS = new Set(['id', 'kind', 'bossTurns']);
const BOSS_TURN_KEYS = new Set(['intent', 'spell', 'wordId']);
const BOSS_TURN_COUNT = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonnegativeInteger(value: unknown, maximum?: number): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && (maximum === undefined || value <= maximum);
}

function isMissionEvent(value: unknown): value is MissionEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || !VALID_EVENT_KINDS.has(value.kind as MissionEventKind)) {
    return false;
  }

  if (value.kind !== 'boss') {
    return hasOnlyKeys(value, NON_BOSS_EVENT_KEYS) && typeof value.wordId === 'string';
  }

  if (!hasOnlyKeys(value, BOSS_EVENT_KEYS) || !Array.isArray(value.bossTurns) || value.bossTurns.length !== BOSS_TURN_COUNT) {
    return false;
  }

  return value.bossTurns.every((turn) => isRecord(turn)
    && hasOnlyKeys(turn, BOSS_TURN_KEYS)
    && typeof turn.wordId === 'string'
    && VALID_BOSS_INTENTS.has(turn.intent as BossIntent)
    && VALID_SPELLS.has(turn.spell as Spell));
}

function isCompletedEventState(
  events: MissionEvent[],
  eventIndex: number,
  completedEventIds: string[],
): boolean {
  const completedIds = new Set(completedEventIds);
  const currentEvent = events[eventIndex];
  const completedBeforeCurrent = events.slice(0, eventIndex).map((event) => event.id);
  const completedCurrentEvent = currentEvent.kind === 'boss'
    ? completedBeforeCurrent
    : [...completedBeforeCurrent, currentEvent.id];

  return completedIds.size === completedEventIds.length
    && (arraysEqual(completedEventIds, completedBeforeCurrent)
      || arraysEqual(completedEventIds, completedCurrentEvent));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isBossLifecycleState(
  eventIndex: number,
  bossIndex: number,
  bossTurn: number,
  rescued: unknown,
  legacyRoomFlow: unknown,
): boolean {
  const hasValidTurn = rescued ? bossTurn === BOSS_TURN_COUNT : bossTurn < BOSS_TURN_COUNT;

  return hasValidTurn && (legacyRoomFlow === true || bossTurn === 0 || eventIndex === bossIndex);
}

function isAdventureState(value: unknown): value is AdventureState {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ADVENTURE_KEYS)
    || value.version !== 2
    || !Array.isArray(value.events)
    || value.events.length === 0
    || !value.events.every(isMissionEvent)
    || !isNonnegativeInteger(value.eventIndex)
    || value.eventIndex >= value.events.length
    || !isNonnegativeInteger(value.bossTurn, BOSS_TURN_COUNT)
    || !isStringArray(value.completedEventIds)) {
    return false;
  }

  const events = value.events as MissionEvent[];
  const eventIds = events.map((event) => event.id);
  const bossIndex = events.findIndex((event) => event.kind === 'boss');
  const rescued = value.rescued;

  return typeof value.seed === 'number'
    && Number.isFinite(value.seed)
    && new Set(eventIds).size === eventIds.length
    && bossIndex === events.length - 1
    && isBossLifecycleState(value.eventIndex, bossIndex, value.bossTurn, rescued, value.legacyRoomFlow)
    && typeof value.spellReady === 'boolean'
    && typeof rescued === 'boolean'
    && isCompletedEventState(events, value.eventIndex, value.completedEventIds)
    && isStringArray(value.rewards)
    && Array.isArray(value.modesUsed)
    && value.modesUsed.every((profile) => VALID_PROFILES.has(profile as LearnerProfile))
    && VALID_ROOMS.has(value.room as AdventureState['room'])
    && (value.legacyRoomFlow === undefined || value.legacyRoomFlow === true);
}

function projectEvent(event: MissionEvent): MissionEvent {
  if (event.kind === 'boss') {
    return {
      id: event.id,
      kind: event.kind,
      bossTurns: event.bossTurns?.map(({ intent, spell, wordId }) => ({ intent, spell, wordId })),
    };
  }

  return { id: event.id, kind: event.kind, wordId: event.wordId };
}

function projectAdventure(state: AdventureState): AdventureState {
  const projected: AdventureState = {
    version: state.version,
    seed: state.seed,
    events: state.events.map(projectEvent),
    eventIndex: state.eventIndex,
    bossTurn: state.bossTurn,
    spellReady: state.spellReady,
    completedEventIds: [...state.completedEventIds],
    rescued: state.rescued,
    rewards: [...state.rewards],
    modesUsed: [...state.modesUsed],
    room: state.room,
  };

  return state.legacyRoomFlow ? { ...projected, legacyRoomFlow: true } : projected;
}

export function loadAdventureFromStorage(): AdventureState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADVENTURE);
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    return isAdventureState(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveAdventureToStorage(state: AdventureState): void {
  localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(projectAdventure(state)));
}

export function clearAdventureFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY_ADVENTURE);
}
