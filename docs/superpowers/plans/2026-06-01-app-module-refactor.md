# App Module Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `web/src/App.tsx` into focused persistence, component, and screen modules without changing gameplay behavior.

**Architecture:** `App.tsx` remains the reducer/effect coordinator and delegates persistence to `web/src/persistence/vocabStorage.ts` and rendering to presentational screen components. Screen components receive state snapshots and callbacks; they do not read storage or dispatch actions directly.

**Tech Stack:** React 18, TypeScript, Jest, Testing Library, esbuild.

---

## File Structure

- Create: `web/src/persistence/vocabStorage.ts`
  - Owns vocabulary and language localStorage keys, load/save helpers, and default artwork hydration.
- Create: `web/src/persistence/vocabStorage.test.ts`
  - Covers storage parsing fallback, language defaults, save/load round trips, and default artwork hydration.
- Create: `web/src/components/LanguageSelector.tsx`
  - Owns the existing recognition language select UI.
- Create: `web/src/components/LanguageSelector.test.tsx`
  - Covers menu and compact selector rendering plus change callback.
- Create: `web/src/screens/MenuScreen.tsx`
  - Presentational main menu.
- Create: `web/src/screens/VictoryScreen.tsx`
  - Presentational victory screen.
- Create: `web/src/screens/GameScreen.tsx`
  - Presentational gameplay screen.
- Modify: `web/src/App.tsx`
  - Remove storage helpers, `LanguageSelector`, and render functions.
  - Pass typed props/callbacks into screen components.

## Task 1: Baseline Verification

- [ ] **Step 1: Confirm clean branch**

Run: `git status --short --branch`

Expected: current branch is `codex/app-module-refactor`; no uncommitted source changes except the plan if it is not yet committed.

- [ ] **Step 2: Run current test suite**

Run from `web`: `npm test -- --runInBand`

Expected: all current tests pass before refactoring begins.

## Task 2: Extract Storage Helpers With TDD

**Files:**
- Create: `web/src/persistence/vocabStorage.test.ts`
- Create: `web/src/persistence/vocabStorage.ts`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write the failing storage test**

Add tests that import these future exports:

```ts
import {
  STORAGE_KEY_LANG,
  STORAGE_KEY_VOCAB,
  hydrateDefaultVocabArtwork,
  loadLangFromStorage,
  loadVocabFromStorage,
  saveLangToStorage,
  saveVocabToStorage,
} from './vocabStorage';
```

Cover these behaviors:

- `hydrateDefaultVocabArtwork` restores bundled `imageSrc` when a stored default word has no image data.
- `loadVocabFromStorage` returns an empty list for invalid JSON.
- `saveVocabToStorage` and `loadVocabFromStorage` round-trip a custom item.
- `loadLangFromStorage` defaults to `en-US`; `saveLangToStorage` persists a selected language.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/persistence/vocabStorage.test.ts --runInBand`

Expected: FAIL because `./vocabStorage` does not exist.

- [ ] **Step 3: Implement minimal storage module**

Move the storage constants and helper logic out of `App.tsx` into `web/src/persistence/vocabStorage.ts`. Keep key names exactly:

```ts
export const STORAGE_KEY_VOCAB = 'echoquest_vocab_v1';
export const STORAGE_KEY_LANG = 'echoquest_lang_v1';
```

- [ ] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/persistence/vocabStorage.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Wire App to storage module**

Import `loadVocabFromStorage`, `saveVocabToStorage`, `loadLangFromStorage`, and `saveLangToStorage` in `App.tsx`; remove the local helper definitions.

- [ ] **Step 6: Run App regression tests**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS, including the bundled artwork hydration test.

## Task 3: Extract LanguageSelector With TDD

**Files:**
- Create: `web/src/components/LanguageSelector.test.tsx`
- Create: `web/src/components/LanguageSelector.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write the failing component test**

Test that the menu variant renders the globe-enhanced selector with `aria-label="Select recognition language"` and calls `onLangChange('en-GB')` when changed. Test that the compact variant renders the same options without requiring menu layout.

- [ ] **Step 2: Verify RED**

Run from `web`: `npm test -- src/components/LanguageSelector.test.tsx --runInBand`

Expected: FAIL because `LanguageSelector.tsx` does not exist.

- [ ] **Step 3: Move LanguageSelector**

Create `web/src/components/LanguageSelector.tsx` with the exact language options currently embedded in `App.tsx`. Remove the embedded component from `App.tsx` and import the new component.

- [ ] **Step 4: Verify GREEN**

Run from `web`: `npm test -- src/components/LanguageSelector.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: Run App regression tests**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS.

## Task 4: Extract Menu and Victory Screens

**Files:**
- Create: `web/src/screens/MenuScreen.tsx`
- Create: `web/src/screens/VictoryScreen.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Move main menu JSX**

Create `MenuScreen` with props:

```ts
type MenuScreenProps = {
  recognitionLang: string;
  speechSupported: boolean;
  message: string;
  onRecognitionLangChange: (lang: string) => void;
  onStartGame: () => void;
  onOpenVocabManagement: () => void;
};
```

- [ ] **Step 2: Move victory JSX**

Create `VictoryScreen` with props:

```ts
type VictoryScreenProps = {
  score: number;
  correctAnswers: number;
  onStartGame: () => void;
};
```

- [ ] **Step 3: Wire App switch**

Replace `renderMenu()` and `renderVictory()` calls with `<MenuScreen />` and `<VictoryScreen />`.

- [ ] **Step 4: Run App regression tests**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS for menu and victory tests.

## Task 5: Extract GameScreen

**Files:**
- Create: `web/src/screens/GameScreen.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Define GameScreen props**

Move the gameplay JSX into `GameScreen`. Use explicit props for state values, speech view model, voice review, and callbacks. Keep the speech review state owned by `App.tsx`.

- [ ] **Step 2: Wire callbacks from App**

Pass callbacks for submit, skip, input change, hint press/release, retry voice review, confirm voice review, mode toggle, listening toggle, and language change.

- [ ] **Step 3: Remove old renderGame function**

Delete `renderGame()` from `App.tsx` and render `<GameScreen />` in the `playing` branch.

- [ ] **Step 4: Run voice and gameplay regression tests**

Run from `web`: `npm test -- src/App.test.tsx --runInBand`

Expected: PASS for text answer, skip, hint, speech errors, voice review, duplicate speech result, and late speech result tests.

## Task 6: Final Verification and PR

- [ ] **Step 1: Run full tests**

Run from `web`: `npm test -- --runInBand`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run from `web`: `npm run build`

Expected: TypeScript and esbuild complete successfully.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat` and `git diff --check`

Expected: diff is focused on #55 and has no whitespace errors.

- [ ] **Step 4: Commit implementation**

Commit message: `refactor: split app modules`

- [ ] **Step 5: Push and open PR**

Push branch `codex/app-module-refactor` and open a PR to `main` that closes #55.
