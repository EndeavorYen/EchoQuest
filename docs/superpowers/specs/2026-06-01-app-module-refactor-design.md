# App Module Refactor Design

## Context

Issue #55 targets `web/src/App.tsx`, which currently owns persistence, speech review policy, game orchestration, and screen rendering in one file. After PR #66, the speech flow is stable but also makes `App.tsx` harder to change safely. This refactor prepares the project for future learning, animation, vocabulary, and accessibility work without changing gameplay behavior.

## Goals

- Keep the current player-facing behavior, copy, storage keys, visual classes, and reducer actions unchanged.
- Reduce `App.tsx` to the application orchestration layer: reducer wiring, effects, and screen routing.
- Move localStorage and default artwork hydration into a focused persistence module.
- Move reusable UI rendering into focused components for language selection and app screens.
- Preserve the existing App-level tests as the primary regression safety net and add focused tests for newly exported pure helpers.

## Non-Goals

- No visual redesign, animation changes, gameplay tuning, scoring changes, or new pronunciation feedback.
- No reducer rewrite and no new state management library.
- No change to bundled vocabulary, level data, or localStorage key names.

## Architecture

`App.tsx` remains the stateful coordinator. It creates reducer state, connects speech recognition to game submission, persists vocabulary and recognition language, and chooses which screen to render.

Storage logic moves to `web/src/persistence/vocabStorage.ts`. This module exposes vocabulary and language load/save helpers plus default artwork hydration. It depends only on vocabulary data and types, so it can be tested without rendering React.

UI rendering moves out of `App.tsx`:

- `web/src/components/LanguageSelector.tsx` renders the existing recognition language selector.
- `web/src/screens/MenuScreen.tsx` renders the main menu.
- `web/src/screens/VictoryScreen.tsx` renders the victory screen.
- `web/src/screens/GameScreen.tsx` renders the active gameplay screen and receives all required data and callbacks as props.

The screen components remain presentational. They do not dispatch reducer actions directly and do not read from localStorage. `App.tsx` passes callbacks such as `onStartGame`, `onSubmit`, `onSkip`, `onSetUserInput`, `onTogglePracticeMode`, and `onRecognitionLangChange`.

## Data Flow

1. `App.tsx` initializes reducer state with `loadLangFromStorage()`.
2. On mount, `App.tsx` loads vocabulary through `loadVocabFromStorage()` unless `initialVocab` is provided.
3. `App.tsx` persists vocabulary and language through storage helpers.
4. `App.tsx` computes game values such as enabled vocabulary and word selection.
5. `App.tsx` passes state snapshots and callbacks to screen components.
6. Screen components emit user intent through callbacks only.

## Speech Flow Boundary

For this PR, speech review policy stays in `App.tsx` unless extracting it is needed to make `GameScreen` props manageable. This keeps the recent #66 behavior close to its existing tests. The active game screen receives a `speech` view model, `voiceReview`, and callbacks for retry, confirm, mode toggle, and listening toggle.

## Testing Strategy

- Keep `web/src/App.test.tsx` as end-to-end regression coverage for menu, gameplay, storage hydration, and speech review behavior.
- Add `web/src/persistence/vocabStorage.test.ts` before extracting storage helpers.
- Run the focused new test to verify it fails before implementation.
- Run `npm test -- --runInBand` and `npm run build` before committing and before opening the PR.

## Acceptance Criteria

- `App.tsx` no longer defines localStorage helpers, `LanguageSelector`, or full screen render functions.
- Existing UI text, ARIA labels, CSS class names, and storage keys continue to work.
- The default vocabulary artwork hydration behavior is covered by focused unit tests.
- Full test suite and production build pass.
