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

2026-06-29 rebuild:
- Root cause review: the old default voice path used continuous listening plus auto-restart, which is fragile for browser permissions and React lifecycle state.
- Replaced the default App entry with a no-blocking arcade learning loop: toddler picture match, kid letter assembly, adult typing, and optional confirmed voice for kid/adult.
- Simplified voice behavior to one explicit listen action followed by review/confirm; typing and spelling remain available even when speech recognition is unsupported.
- Added new App regression tests for toddler picture matching, kid spelling, adult typing, adult voice review, and unsupported-voice fallback.

Art polish:
- Added level-themed scene palettes, terrain texture, staged boss/word presentation, richer button/tile materials, and simple hit feedback animation.
- Kept it CSS-only for now; no new image pipeline or dependencies.

Age-review follow-up:
- Subagents reviewed toddler, kid, and adult/parent flows.
- Fixed mobile order so word/input appear before boss/status.
- Toddler now starts with two choices and has a wrong-then-correct regression test.
- Kid spelling now shows the first letter and clears used tiles after a wrong attack.
- Unsupported speech now shows a fallback note instead of a disabled primary voice control.

2026-07-11 Task 1:
- Tracking issue: https://github.com/EndeavorYen/EchoQuest/issues/69
- Added pure adventure domain functions: createAdventure, completeRoomChallenge, getBossTurn, and castSpell.
- Focused test result: `npm test -- src/game/adventure.test.ts --runInBand` passed 2 tests.
- Self-review: three fixed boss turns are sufficient for the first vertical slice.

2026-07-11 family magic adventure rebuild:
- Replaced the dashboard/boss-HP loop with orchard, bridge, and rescue rooms plus a shared family victory.
- Rescue requires a correct learning answer before each spell; wrong spells preserve the room and charge.
- Removed speech auto-restart, fixed React Strict Mode replay, and stopped active recognition before player/room transitions.
- Browser QA completed the full mission at 1365x900 and 390x844. Mobile challenge bottom was 752px in an 844px viewport; toddler choices were 81.56px high and spell buttons 72px high; no horizontal overflow or console errors were found.
- Chrome exposed Web Speech API and the permission/fallback path worked without blocking typing. Physical spoken recognition could not be supplied by automation and remains a hardware smoke test on the player's machine.
- Visual review found fixed-word copy, duplicate transparent art, and black asset backgrounds. Orchard copy is now target-neutral and transparent PNGs render once over room colors instead of as full-screen backgrounds.
- Final verification passed 16 suites / 106 tests and a 176.9kb production build. Post-fix desktop/mobile screenshots show no large black fields or duplicate scene art; console errors remain zero.
