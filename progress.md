Original prompt: 請設定目標並執行，於每個階段自評並改進

Goal: Add a learner-profile challenge layer so EchoQuest can serve toddler, kid, and adult players without splitting into three games.

Phase 0 baseline:
- npm test -- --runInBand passed: 13 suites, 106 tests.
- Existing worktree already has feedback/audio changes; keep this pass scoped to profile/challenge architecture.

Phase 1 challenge logic:
- Added web/src/game/challenges.ts and web/src/game/challenges.test.ts.
- npm test -- src/game/challenges.test.ts --runInBand passed.
- Self-review: 2y starts with two choices by design; upgrade to three choices after real use.

Phase 2 profile state:
- Added learnerProfile state, storage, and menu selection.
- npm test -- src/persistence/vocabStorage.test.ts src/game/gameReducer.test.ts --runInBand passed.
- Self-review: localStorage profile is enough for one-family local use; do not add accounts yet.

Phase 3 challenge UI:
- Toddler mode renders image choice buttons and hides voice/typing controls.
- Kid spelling mode renders a first-letter hint while keeping the existing input path.
- npm test -- src/App.test.tsx src/game/challenges.test.ts --runInBand passed.
- Self-review: UI is intentionally simple; add adaptive 3-choice mode after observing real 2y use.

Next:
- Run full verification.
- Fix build copy behavior if it still blocks production build.

Phase 4 verification:
- npm test -- --runInBand passed: 14 suites, 115 tests.
- npm run build passed after making copy-html skip copying identical files.
- git diff --check passed, with only line-ending warnings.
- Playwright web-game client could not run because the environment lacks the playwright package.

Next improvements:
- Add adaptive toddler choice count: 2 choices first, then 3 after stable correct streaks.
- Add boss-specific intents after the profile layer settles.
- Add Codex image2 backgrounds and boss state art once the encounter rules are stable.

2026-06-29 continuation:
- Added full roadmap at docs/superpowers/plans/2026-06-29-multi-age-gameplay-upgrade.md.
- Added adaptive toddler 3-choice mode when word mastery is 2+.
- Reduced kid hints for mastered words from first-letter blanks to first letter only.
- Added encounter intents with toddler/kid/adult copy and a compact UI chip.
- Self-review: intents are presentational only; the next slice should connect them to real battle mechanics.

Review follow-up:
- Fixed toddler image-choice attempts so progress stores lastMode as image_choice instead of voice.
- Added README.md with profile, development, verification, and roadmap notes.
