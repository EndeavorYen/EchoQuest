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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    return typeof value.wordId === 'string';
  }

  if (!Array.isArray(value.bossTurns) || value.bossTurns.length !== 3) {
    return false;
  }

  return value.bossTurns.every((turn) => isRecord(turn)
    && typeof turn.wordId === 'string'
    && VALID_BOSS_INTENTS.has(turn.intent as BossIntent)
    && VALID_SPELLS.has(turn.spell as Spell));
}

function isAdventureState(value: unknown): value is AdventureState {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.events) || value.events.length === 0) {
    return false;
  }

  const events = value.events;
  const bossEvents = events.filter((event) => isRecord(event) && event.kind === 'boss');

  return typeof value.seed === 'number'
    && Number.isFinite(value.seed)
    && events.every(isMissionEvent)
    && bossEvents.length === 1
    && isNonnegativeInteger(value.eventIndex)
    && value.eventIndex < events.length
    && isNonnegativeInteger(value.bossTurn, 3)
    && typeof value.spellReady === 'boolean'
    && isStringArray(value.completedEventIds)
    && typeof value.rescued === 'boolean'
    && isStringArray(value.rewards)
    && Array.isArray(value.modesUsed)
    && value.modesUsed.every((profile) => VALID_PROFILES.has(profile as LearnerProfile))
    && VALID_ROOMS.has(value.room as AdventureState['room'])
    && (value.legacyRoomFlow === undefined || value.legacyRoomFlow === true);
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
  localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(state));
}

export function clearAdventureFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY_ADVENTURE);
}
