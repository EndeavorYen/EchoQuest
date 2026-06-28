# Multi-Age Gameplay Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make EchoQuest feel playable for a 2-year-old, a 5-year-old, and an adult without splitting the project into three games.

**Architecture:** Keep one React game shell and route each round through a learner-profile challenge layer. Level data owns fantasy and boss rules; challenge generation owns input difficulty; UI renders the current challenge without knowing age-specific selection rules.

**Tech Stack:** React 18, TypeScript, Jest, esbuild, localStorage, existing generated PNG assets.

---

## Roadmap

### Phase 1: Learner Profile Foundation

**Files:**
- Create: `web/src/game/challenges.ts`
- Test: `web/src/game/challenges.test.ts`
- Modify: `web/src/game/gameReducer.ts`
- Modify: `web/src/persistence/vocabStorage.ts`
- Modify: `web/src/screens/MenuScreen.tsx`
- Modify: `web/src/screens/GameScreen.tsx`

- [x] Add `LearnerProfile = 'toddler' | 'kid' | 'adult'`.
- [x] Add challenge modes for image choice, guided typing, free typing, and voice.
- [x] Persist selected profile in `echoquest_profile_v1`.
- [x] Render toddler image choice and kid first-letter guided typing.
- [x] Verify with Jest and production build.

### Phase 2: Adaptive Challenge Difficulty

**Files:**
- Modify: `web/src/game/challenges.ts`
- Modify: `web/src/game/challenges.test.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`

- [x] Toddler mode starts with 2 picture choices.
- [x] Toddler mode upgrades to 3 picture choices when the current word has mastery 2 or higher.
- [x] Kid guided typing shows first-letter hints for new words and shorter hints for mastered words.
- [x] Adult mode remains free typing or voice, with no forced hints.

### Phase 3: Boss Intent Layer

**Files:**
- Create: `web/src/game/encounters.ts`
- Test: `web/src/game/encounters.test.ts`
- Modify: `web/src/screens/GameScreen.tsx`
- Modify: `web/public/index.html`

- [x] Add deterministic boss intents by level: dragon flame, goblin trick, golem guard, wizard spell, gate seal.
- [x] Show one compact intent chip in the play screen.
- [x] Keep toddler copy gentle and non-punitive.
- [x] Keep adult copy tactical enough to make encounters feel different.

### Phase 4: Scene Visual Upgrade

**Files:**
- Modify: `web/public/index.html`
- Modify: `web/src/screens/GameScreen.tsx`
- Add assets under: `web/public/assets/generated/`

- [ ] Convert the left level panel into a scene stage using existing boss art first.
- [ ] Generate Codex image2 biome backgrounds after encounter rules settle.
- [ ] Add boss state art only after idle/hurt/defeated states exist in data.

### Phase 5: Playtest And Push

**Commands:**
- `npm test -- --runInBand`
- `npm run build`
- `git diff --check`
- Browser smoke test when Playwright is installed.
- `git push -u origin feature/multi-age-gameplay-upgrade`

## Current Execution Slice

This branch executes Phase 2 and the first compact part of Phase 3. Image2 assets are deliberately deferred until rules and UI states stop moving.

## Self-Review

- Spec coverage: 2y, 5y, and adult modes are represented by one shared challenge layer.
- YAGNI check: no account system, no Phaser rewrite, no new dependency.
- Known ceiling: toddler mastery currently uses stored word mastery, not separate child-specific progress. Add per-profile progress only if family use shows mastery conflicts.
