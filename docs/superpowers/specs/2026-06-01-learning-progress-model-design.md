# Learning Progress Model Design

## Context

Issue #59 asks EchoQuest to remember what the learner knows, which words they miss, and which words should come back for review. The current game tracks only session score, combo, correct answer count, and skipped words. Vocabulary definitions already persist through `echoquest_vocab_v1`; learning progress must be stored separately so imported vocabulary is not corrupted.

## Goals

- Persist per-word learning progress independently from vocabulary definitions.
- Record every submitted answer with mode, correctness, timestamp, streak, and miss/correct totals.
- Prioritize weak or due-for-review words during word selection while preserving level constraints and puzzle tool rules.
- Show actionable mistake feedback that includes the target word and the submitted answer.
- Add a lightweight victory summary with learning progress, not only score.
- Keep the first implementation small enough to review and merge safely.

## Non-Goals

- No large dashboard, mastery charts, account sync, analytics backend, or full spaced-repetition scheduler.
- No pronunciation scoring beyond recording voice vs spelling attempts.
- No visual redesign; UI additions should use existing components and class patterns.
- No change to the existing vocabulary storage key or stored vocabulary shape.

## Data Model

Create `web/src/learning/progress.ts` with:

```ts
export type PracticeMode = 'voice' | 'spelling';

export type WordProgress = {
  wordId: string;
  word: string;
  attempts: number;
  correct: number;
  misses: number;
  streak: number;
  mastery: 0 | 1 | 2 | 3;
  lastPracticedAt: number | null;
  lastMissedAt: number | null;
  lastMode: PracticeMode | null;
  dueAt: number;
};

export type LearningProgressState = Record<string, WordProgress>;
```

The key is the vocabulary item id, not the word string. The word string is stored as a display snapshot in case the item is renamed later.

Mastery is intentionally simple:

- `0`: new or struggling.
- `1`: one recent correct answer.
- `2`: two or more correct streak.
- `3`: three or more correct streak.

Review timing is lightweight:

- Incorrect answers are due immediately.
- Mastery 0 correct answers are due in 1 hour.
- Mastery 1 correct answers are due in 1 day.
- Mastery 2 correct answers are due in 3 days.
- Mastery 3 correct answers are due in 7 days.

## Storage

Create `web/src/persistence/progressStorage.ts` using key `echoquest_progress_v1`.

Exports:

- `loadProgressFromStorage(): LearningProgressState`
- `saveProgressToStorage(progress: LearningProgressState): void`

Invalid JSON or unexpected shapes return an empty object. This keeps bad progress data from breaking gameplay.

## Game Integration

`AppState` gains:

- `progress: LearningProgressState`
- `lastAnswerFeedback: AnswerFeedback | null`

Answer feedback contains:

```ts
type AnswerFeedback = {
  word: string;
  submitted: string;
  isCorrect: boolean;
  mode: PracticeMode;
  mastery: WordProgress['mastery'];
  nextReviewLabel: string;
};
```

`handleSubmit` computes correctness, updates progress with `recordPracticeAttempt`, dispatches the existing scoring action, and persists progress through a React effect.

Incorrect answer copy changes from a generic message to a learner-facing line such as:

`再試一次：你輸入「apl」，目標是 apple。這題會優先複習。`

Voice submissions use the same feedback shape, with `mode: 'voice'`.

## Word Selection

Add `rankWordsForReview(words, progress, now)` in `web/src/learning/progress.ts`. It does not replace level filtering. `App.tsx` still calls `getAvailableWords` first, then ranks those candidates before `selectWord`.

Ranking:

1. Due words first.
2. Lower mastery first.
3. Higher misses first.
4. Never-practiced words before already-stable words.
5. Preserve the existing random selection among the best priority group.

This keeps the game feeling varied while nudging practice toward weak words.

## UI

`GameScreen` receives `lastAnswerFeedback` and renders a small feedback block inside the challenge panel when available. It appears with the existing message area and uses existing color tokens.

`VictoryScreen` receives a summary:

- words practiced this run
- mastered words
- review words due now

The first version only needs text; future #60 can animate it.

## Testing Strategy

- Unit-test progress math in `web/src/learning/progress.test.ts`.
- Unit-test storage fallback and round-trip in `web/src/persistence/progressStorage.test.ts`.
- Extend reducer tests for progress and feedback state updates.
- Extend App tests for:
  - incorrect feedback includes submitted and target word,
  - progress persists after a correct/incorrect answer,
  - weak/due words are prioritized when selecting the next word,
  - victory screen shows learning summary.

## Acceptance Criteria

- Progress persists in `echoquest_progress_v1` and never overwrites `echoquest_vocab_v1`.
- Correct and incorrect submissions update per-word progress.
- Word selection prioritizes due/weak words within existing available-word constraints.
- Incorrect answers provide actionable feedback beyond `再試一次!`.
- Victory screen shows a learning summary in addition to score.
- Full test suite and production build pass.
