# Feedback Animation Audio System Design

## Product Goal

EchoQuest should feel like a cohesive learning game, not a set of isolated question-and-answer screens. Issue #60 is the first feedback-focused milestone in the larger uplift: make every answer, voice interaction, level transition, and learning moment feel understandable, encouraging, accessible, and predictable.

## Context

The current feedback surface is scattered:

- `web/src/game/gameReducer.ts` stores `showEffect` and `isBossShaking`.
- `web/src/screens/GameScreen.tsx` maps those booleans to `eq-word-stage--success`, `shake`, and `animate-bounce`.
- `web/src/App.tsx` directly calls `speechSynthesis.speak()` after incorrect answers.
- `web/public/index.html` has a global `shake` keyframe and a broad reduced-motion rule.

This works, but it makes feedback hard to reason about. A future visual, voice, or gameplay change has to touch multiple unrelated places.

## Goals

- Replace scattered feedback booleans with typed feedback events.
- Keep scoring and learning progress behavior unchanged.
- Make correct, incorrect, level-complete, combo, voice-heard, and voice-error states visually distinct.
- Keep motion purposeful: short transform/opacity changes, no layout animation, no bounce/elastic movement.
- Respect `prefers-reduced-motion` with static or near-static alternatives.
- Move speech synthesis behind a predictable audio instruction model.
- Add tests for event creation, reducer state transitions, audio instruction behavior, and UI visibility.

## Non-Goals

- No new settings screen in this PR.
- No background music, generated sound assets, or external audio library.
- No redesign of the full game layout.
- No change to vocabulary storage, learning progress storage, scoring, or word selection.

## Design Direction

Tone: playful field-guide adventure. Feedback should feel like a guide calmly responding to the learner: crisp impact for correct answers, grounded repair for mistakes, celebratory but brief level completion, and quiet voice status updates.

Motion rules:

- Correct answer: lift and glow the word target briefly.
- Incorrect answer: mark the challenge with a short caution state, not aggressive shaking.
- Level complete: brief panel-level highlight and readable message.
- Combo up: small HUD pulse when combo increases.
- Voice heard/error: status panel reveal, no surprise motion.
- Reduced motion: remove transforms and keyframes; keep color, border, and text changes.

## Architecture

Create a new `web/src/feedback` module:

- `feedbackEvents.ts`
  - Owns `FeedbackKind`, `FeedbackEvent`, `createFeedbackEvent`, and presentation helpers.
  - Produces stable CSS/data attributes from event kind.
- `feedbackAudio.ts`
  - Owns pure speech-instruction creation.
  - Converts feedback events into optional, predictable speech instructions.

Update state:

- `AppState.feedbackEvent: FeedbackEvent | null`
- Remove `showEffect` and `isBossShaking` after the event path replaces them.
- Add reducer actions `SET_FEEDBACK_EVENT` and `CLEAR_FEEDBACK_EVENT`.

Update UI:

- `GameScreen` receives `feedbackEvent`.
- Word, enemy, message, voice review, and HUD classes derive from event presentation instead of ad hoc booleans.
- Feedback markup exposes `data-feedback-kind` so tests and future styling can target states intentionally.

Update App:

- `handleSubmit` creates `correct` or `incorrect` events.
- Level transition flow creates `levelComplete` when a level completes.
- Voice review creates `voiceHeard`; speech errors create `voiceError`.
- Audio playback calls the audio helper only for predictable instructions. The first PR keeps spoken feedback to incorrect-answer target-word reinforcement.

## Testing Strategy

- Unit-test feedback event creation and presentation mapping.
- Unit-test speech instruction creation: incorrect answers speak the target word; correct/level/voice events do not speak by default.
- Extend reducer tests to verify feedback event state replaces old booleans.
- Extend App tests to verify correct/incorrect/level/voice feedback events render with expected kind and copy.
- Keep existing tests for score, learning progress, speech review, and level flow passing.

## Acceptance Criteria

- Feedback states are represented explicitly by typed events.
- Existing `showEffect` / `isBossShaking` paths are removed or no longer drive UI.
- Motion classes are centralized and respect reduced-motion CSS.
- Correct, incorrect, and level-complete feedback are visually distinct and readable.
- Speech synthesis is routed through a predictable audio instruction helper.
- Full test suite and production build pass.
- PR closes #60.
