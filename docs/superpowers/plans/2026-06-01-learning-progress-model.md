# Learning Progress Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent per-word learning progress, weak-word selection priority, actionable answer feedback, and a lightweight victory learning summary.

**Architecture:** Learning math lives in `web/src/learning/progress.ts`, persistence lives in `web/src/persistence/progressStorage.ts`, and `App.tsx` coordinates updates with the existing reducer and screens. Vocabulary storage remains unchanged; progress uses a separate localStorage key.

**Tech Stack:** React 18, TypeScript, Jest, Testing Library, localStorage.

---

## File Structure

- Create: `web/src/learning/progress.ts`
  - Owns progress types, attempt recording, review ranking, and summary helpers.
- Create: `web/src/learning/progress.test.ts`
  - TDD coverage for mastery updates, due timing, ranking, and summary.
- Create: `web/src/persistence/progressStorage.ts`
  - Owns `echoquest_progress_v1` load/save.
- Create: `web/src/persistence/progressStorage.test.ts`
  - Covers invalid JSON fallback, shape filtering, and round trip.
- Modify: `web/src/game/gameReducer.ts`
  - Adds progress and answer feedback to state/actions.
- Modify: `web/src/game/gameReducer.test.ts`
  - Covers progress state setting and feedback clearing on new game/word.
- Modify: `web/src/App.tsx`
  - Loads/persists progress, records attempts, ranks available words, passes feedback/summary to screens.
- Modify: `web/src/screens/GameScreen.tsx`
  - Renders actionable answer feedback.
- Modify: `web/src/screens/VictoryScreen.tsx`
  - Renders learning summary.
- Modify: `web/src/App.test.tsx`
  - Covers persisted progress, weak-word priority, incorrect feedback, and victory summary.

## Task 1: Baseline Verification

- [ ] **Step 1: Confirm branch and clean start**

Run: `git status --short --branch`

Expected: current branch is `codex/learning-progress-model`; no uncommitted source changes except this plan before commit.

- [ ] **Step 2: Run current tests**

Run from `web`: `npm test -- --runInBand`

Expected: all current tests pass before implementation begins.

## Task 2: Learning Progress Model TDD

**Files:**
- Create: `web/src/learning/progress.test.ts`
- Create: `web/src/learning/progress.ts`

- [ ] **Step 1: Write failing tests for progress updates**

Create tests importing:

```ts
import {
  buildLearningSummary,
  createAnswerFeedback,
  rankWordsForReview,
  recordPracticeAttempt,
} from './progress';
```

Test these concrete behaviors:

- A first correct spelling attempt creates progress with `attempts: 1`, `correct: 1`, `misses: 0`, `streak: 1`, `mastery: 1`, `lastMode: 'spelling'`, and `dueAt` later than `now`.
- An incorrect voice attempt resets `streak` to `0`, increments `misses`, keeps `mastery: 0`, sets `lastMissedAt`, and makes `dueAt === now`.
- Three consecutive correct attempts cap mastery at `3`.
- `rankWordsForReview` puts due lower-mastery words ahead of stable words.
- `buildLearningSummary` counts practiced, mastered, and due words.
- `createAnswerFeedback` includes submitted text, target word, correctness, mode, mastery, and a readable next review label.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/learning/progress.test.ts --runInBand`

Expected: FAIL because `./progress` does not exist.

- [ ] **Step 3: Implement minimal learning model**

Create `web/src/learning/progress.ts` with exported types:

```ts
export type PracticeMode = 'voice' | 'spelling';
export type MasteryLevel = 0 | 1 | 2 | 3;
export type LearningProgressState = Record<string, WordProgress>;
```

Implement:

- `recordPracticeAttempt(progress, word, attempt)` returning a new progress object.
- `rankWordsForReview(words, progress, now)` returning a sorted copy.
- `buildLearningSummary(progress, now)` returning `{ practicedWords, masteredWords, dueWords }`.
- `createAnswerFeedback({ word, submitted, isCorrect, mode, progress, now })`.

- [ ] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/learning/progress.test.ts --runInBand`

Expected: PASS.

## Task 3: Progress Storage TDD

**Files:**
- Create: `web/src/persistence/progressStorage.test.ts`
- Create: `web/src/persistence/progressStorage.ts`

- [ ] **Step 1: Write failing storage tests**

Test imports:

```ts
import {
  STORAGE_KEY_PROGRESS,
  loadProgressFromStorage,
  saveProgressToStorage,
} from './progressStorage';
```

Test:

- Missing storage returns `{}`.
- Invalid JSON returns `{}`.
- A valid progress object round-trips through `echoquest_progress_v1`.
- Existing `echoquest_vocab_v1` remains untouched when saving progress.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/persistence/progressStorage.test.ts --runInBand`

Expected: FAIL because `./progressStorage` does not exist.

- [ ] **Step 3: Implement storage module**

Create `progressStorage.ts` with:

```ts
export const STORAGE_KEY_PROGRESS = 'echoquest_progress_v1';
```

Use `JSON.parse` inside `try/catch`; accept only object values.

- [ ] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/persistence/progressStorage.test.ts --runInBand`

Expected: PASS.

## Task 4: Reducer State and Feedback TDD

**Files:**
- Modify: `web/src/game/gameReducer.test.ts`
- Modify: `web/src/game/gameReducer.ts`

- [ ] **Step 1: Write failing reducer tests**

Add tests that assert:

- `createInitialState()` includes `progress: {}` and `lastAnswerFeedback: null`.
- `SET_PROGRESS` replaces progress.
- `SET_LAST_ANSWER_FEEDBACK` stores feedback.
- `START_GAME` clears `lastAnswerFeedback` but preserves persisted `progress`.
- `SELECT_NEW_WORD` clears `lastAnswerFeedback` with user input.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/game/gameReducer.test.ts --runInBand`

Expected: FAIL because action/state fields do not exist.

- [ ] **Step 3: Implement reducer fields/actions**

Add imports for learning types, extend `AppState`, add actions:

```ts
| { type: 'SET_PROGRESS'; payload: LearningProgressState }
| { type: 'SET_LAST_ANSWER_FEEDBACK'; payload: AnswerFeedback | null }
```

Keep scoring actions unchanged.

- [ ] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/game/gameReducer.test.ts --runInBand`

Expected: PASS.

## Task 5: App Integration TDD

**Files:**
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/screens/GameScreen.tsx`
- Modify: `web/src/screens/VictoryScreen.tsx`

- [ ] **Step 1: Write failing App tests**

Add tests that assert:

- Incorrect spelling answer shows `你輸入「wronganswer」，目標是 apple` and persists a miss for the current word in `echoquest_progress_v1`.
- Correct answer persists a correct attempt for the current word.
- When stored progress marks one available word as due/weak, starting the game selects that word before stable alternatives.
- Victory screen includes `練習單字`, `精熟單字`, and `待複習`.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: FAIL because App does not load/persist progress or render learning feedback.

- [ ] **Step 3: Wire progress into App**

In `App.tsx`:

- Load progress from `loadProgressFromStorage()` into reducer on mount.
- Persist `progress` through `saveProgressToStorage(progress)`.
- In `handleSubmit`, call `recordPracticeAttempt` with current word, submitted text, correctness, mode, and `Date.now()`.
- Dispatch `SET_PROGRESS` and `SET_LAST_ANSWER_FEEDBACK`.
- Rank `availableWords` with `rankWordsForReview` before calling `selectWord`.
- Pass `lastAnswerFeedback` to `GameScreen`.
- Pass `buildLearningSummary(progress, Date.now())` to `VictoryScreen`.

- [ ] **Step 4: Render feedback and summary**

In `GameScreen`, render a concise feedback block when `lastAnswerFeedback` is present.

In `VictoryScreen`, render learning summary rows:

- `練習單字: N`
- `精熟單字: N`
- `待複習: N`

- [ ] **Step 5: Verify GREEN**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS.

## Task 6: Final Verification and PR

- [ ] **Step 1: Run full tests**

Run from `web`: `npm test -- --runInBand`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run from `web`: `npm run build`

Expected: TypeScript and esbuild complete successfully.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat` and `git diff --check`

Expected: focused #59 changes and no whitespace errors.

- [ ] **Step 4: Commit implementation**

Commit message: `feat: add learning progress model`

- [ ] **Step 5: Push and open PR**

Push `codex/learning-progress-model` and open a PR to `main` with `Closes #59`.
