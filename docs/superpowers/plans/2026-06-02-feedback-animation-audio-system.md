# Feedback Animation Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build issue #60: a centralized, typed feedback/animation/audio system that makes EchoQuest responses purposeful, accessible, and testable.

**Architecture:** Feedback semantics live in `web/src/feedback`. The reducer stores a single `feedbackEvent` instead of separate visual booleans. `App.tsx` creates events during answer, level, and voice flows; `GameScreen` renders event-driven classes and copy; audio is routed through a pure instruction helper.

**Tech Stack:** React 18, TypeScript, Jest, Testing Library, CSS in `web/public/index.html`, browser `speechSynthesis`.

---

## File Structure

- Create: `web/src/feedback/feedbackEvents.ts`
  - Types and helpers for `FeedbackKind`, `FeedbackEvent`, `createFeedbackEvent`, and `getFeedbackPresentation`.
- Create: `web/src/feedback/feedbackEvents.test.ts`
  - TDD coverage for event defaults and presentation mapping.
- Create: `web/src/feedback/feedbackAudio.ts`
  - Pure speech instruction helper for predictable audio feedback.
- Create: `web/src/feedback/feedbackAudio.test.ts`
  - TDD coverage for incorrect-answer speech and no-op events.
- Modify: `web/src/game/gameReducer.ts`
  - Replace `showEffect` and `isBossShaking` with `feedbackEvent`.
- Modify: `web/src/game/gameReducer.test.ts`
  - Tests for setting/clearing feedback events and preserving gameplay state.
- Modify: `web/src/App.tsx`
  - Create feedback events during answer, voice, and level-complete flows.
  - Trigger speech through `feedbackAudio.ts`.
- Modify: `web/src/screens/GameScreen.tsx`
  - Render event-driven classes, `data-feedback-kind`, and readable feedback states.
- Modify: `web/src/App.test.tsx`
  - Integration tests for correct, incorrect, level-complete, voice-heard, and voice-error feedback visibility.
- Modify: `web/public/index.html`
  - Replace scattered shake/bounce styling with event classes and reduced-motion handling.
- Create: `web/src/feedback/feedbackMotionStyles.test.ts`
  - Contract coverage for reduced-motion feedback animation overrides.

## Task 1: Baseline

- [x] **Step 1: Confirm branch and clean start**

Run: `git status --short --branch`

Expected: current branch is `codex/feedback-animation-audio-system`; only this spec/plan may be uncommitted.

- [x] **Step 2: Run baseline tests**

Run from `web`: `npm test -- --runInBand`

Expected: all existing tests pass before production changes.

## Task 2: Feedback Event Model TDD

**Files:**
- Create: `web/src/feedback/feedbackEvents.test.ts`
- Create: `web/src/feedback/feedbackEvents.ts`

- [x] **Step 1: Write failing event model tests**

Create tests for:

```ts
import {
  createFeedbackEvent,
  getFeedbackPresentation,
} from './feedbackEvents';
```

Required behaviors:

- `createFeedbackEvent('correct', { message: 'Nice', now: 1000 })` returns an event with kind `correct`, tone `success`, message `Nice`, and id `correct-1000`.
- `createFeedbackEvent('incorrect', { message: 'Try again', targetWord: 'apple', submitted: 'apl', now: 1000 })` keeps target/submitted details and uses tone `caution`.
- `getFeedbackPresentation(event)` returns stable classes for `wordClassName`, `enemyClassName`, `messageClassName`, and `dataFeedbackKind`.
- Unknown optional fields are not required for voice events; `voiceHeard` and `voiceError` have readable status tones.

- [x] **Step 2: Verify RED**

Run from `web`: `npm test -- src/feedback/feedbackEvents.test.ts --runInBand`

Expected: FAIL because `./feedbackEvents` does not exist.

- [x] **Step 3: Implement minimal event model**

Create `feedbackEvents.ts` with:

```ts
export type FeedbackKind =
  | 'correct'
  | 'incorrect'
  | 'levelComplete'
  | 'comboUp'
  | 'voiceHeard'
  | 'voiceError';

export type FeedbackTone = 'neutral' | 'success' | 'caution' | 'celebration' | 'voice';

export type FeedbackEvent = {
  id: string;
  kind: FeedbackKind;
  tone: FeedbackTone;
  message: string;
  targetWord?: string;
  submitted?: string;
  createdAt: number;
};
```

Add `createFeedbackEvent` and `getFeedbackPresentation`.

- [x] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/feedback/feedbackEvents.test.ts --runInBand`

Expected: PASS.

## Task 3: Audio Instruction TDD

**Files:**
- Create: `web/src/feedback/feedbackAudio.test.ts`
- Create: `web/src/feedback/feedbackAudio.ts`

- [x] **Step 1: Write failing audio tests**

Test:

```ts
import { createSpeechInstruction } from './feedbackAudio';
```

Required behaviors:

- Incorrect feedback with `targetWord: 'apple'` returns `{ text: 'apple', lang: 'en-US' }` when recognition lang is `zh-TW`.
- Incorrect feedback uses the selected English recognition lang when it starts with `en-`.
- Correct, level-complete, combo, voice-heard, and voice-error events return `null` by default.

- [x] **Step 2: Verify RED**

Run from `web`: `npm test -- src/feedback/feedbackAudio.test.ts --runInBand`

Expected: FAIL because `./feedbackAudio` does not exist.

- [x] **Step 3: Implement minimal audio helper**

Create `feedbackAudio.ts` with:

```ts
export type SpeechInstruction = {
  text: string;
  lang: string;
};
```

Implement `createSpeechInstruction(event, recognitionLang)` and keep speech limited to incorrect target-word reinforcement.

- [x] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/feedback/feedbackAudio.test.ts --runInBand`

Expected: PASS.

## Task 4: Reducer Feedback State TDD

**Files:**
- Modify: `web/src/game/gameReducer.test.ts`
- Modify: `web/src/game/gameReducer.ts`

- [x] **Step 1: Write failing reducer tests**

Assert:

- `createInitialState()` includes `feedbackEvent: null`.
- `SET_FEEDBACK_EVENT` stores a feedback event.
- `CLEAR_FEEDBACK_EVENT` clears it.
- `START_GAME`, `SELECT_NEW_WORD`, and `RESET_EFFECTS` clear feedback event.
- `showEffect` and `isBossShaking` are no longer part of the reducer state expectations.

- [x] **Step 2: Verify RED**

Run from `web`: `npm test -- src/game/gameReducer.test.ts --runInBand`

Expected: FAIL because reducer has not been migrated.

- [x] **Step 3: Implement reducer migration**

Replace `showEffect` and `isBossShaking` with `feedbackEvent`. Add actions:

```ts
| { type: 'SET_FEEDBACK_EVENT'; payload: FeedbackEvent }
| { type: 'CLEAR_FEEDBACK_EVENT' }
```

Keep scoring, combo, progress, level, and message behavior unchanged.

- [x] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/game/gameReducer.test.ts --runInBand`

Expected: PASS.

## Task 5: App and UI Integration TDD

**Files:**
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/screens/GameScreen.tsx`
- Modify: `web/public/index.html`

- [x] **Step 1: Write failing App tests**

Add integration tests for:

- Correct spelling answer renders an element with `data-feedback-kind="correct"`.
- Incorrect spelling answer renders `data-feedback-kind="incorrect"` and keeps the actionable submitted/target text.
- Completing a level renders `data-feedback-kind="levelComplete"` before the next level appears.
- A pending voice review renders `data-feedback-kind="voiceHeard"`.
- A transient voice error renders `data-feedback-kind="voiceError"`.

- [x] **Step 2: Verify RED**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: FAIL because the UI still uses scattered booleans/classes.

- [x] **Step 3: Wire feedback events in App**

In `App.tsx`:

- Create correct/incorrect events in `handleSubmit`.
- Create level-complete event before scheduling `NEXT_LEVEL` or victory.
- Create voice-heard event when speech review is populated.
- Create voice-error event when non-blocking speech errors appear.
- Replace direct `speechSynthesis.speak()` calls with `createSpeechInstruction`.

- [x] **Step 4: Render event-driven UI**

In `GameScreen.tsx`:

- Replace `showEffect` and `isBossShaking` props with `feedbackEvent`.
- Call `getFeedbackPresentation(feedbackEvent)`.
- Apply event classes to word stage, enemy figure, and message block.
- Add `data-feedback-kind={presentation.dataFeedbackKind}` to the rendered feedback status block.

In `web/public/index.html`:

- Replace `.shake` with `.eq-enemy-figure--impact`.
- Replace Tailwind `animate-bounce` usage with `.eq-message--feedback`.
- Add reduced-motion overrides for `.eq-word-stage--feedback-*`, `.eq-enemy-figure--impact`, and `.eq-message--feedback`.

- [x] **Step 5: Verify GREEN**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS.

## Task 6: Final Verification and PR

- [x] **Step 1: Run targeted tests**

Run from `web`:

```powershell
npm test -- src/feedback/feedbackEvents.test.ts src/feedback/feedbackAudio.test.ts src/game/gameReducer.test.ts src/App.test.tsx --runInBand
```

Expected: PASS.

- [x] **Step 2: Run full tests**

Run from `web`: `npm test -- --runInBand`

Expected: PASS.

- [x] **Step 3: Run production build**

Run from `web`: `npm run build`

Expected: TypeScript and esbuild complete successfully.

- [x] **Step 4: Inspect diff**

Run from repo root:

```powershell
git diff --stat
git diff --check
```

Expected: focused #60 changes and no whitespace errors.

- [ ] **Step 5: Commit, push, and open PR**

Commit message: `feat: add feedback animation audio system`

PR target: `main`

PR body must include:

- Summary of typed feedback events, reduced-motion styling, and predictable audio.
- Test commands.
- `Closes #60`.
