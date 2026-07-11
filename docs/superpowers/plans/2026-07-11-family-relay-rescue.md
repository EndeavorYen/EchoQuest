# Family Relay Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Rebuild Forest Rescue into a seeded, resumable, scene-first family relay mission where 2y, 5y, and adult inputs advance the same world.

**Architecture:** Keep all deterministic mission state and transitions in web/src/game/adventure.ts. Add one focused adventureStorage module for localStorage, expose only a permission-request flag from the speech hook, and let App.tsx compose the active event, age input, and scene-first presentation.

**Tech Stack:** React 18, TypeScript, Jest, Testing Library, browser localStorage, native Web Speech API, esbuild, static ImageGen PNG assets.

## Global Constraints

- Add no npm dependency, game engine, backend, cloud account, or online multiplayer feature.
- Persist only AdventureState under echoquest_adventure_v2; do not persist unsent typing, letter tiles, microphone requests, or animations.
- Equal seed, vocabulary, learning progress, and recent word ids must produce an equal mission plan.
- Each mission is three unique events from scout, build, escort, evade, then a three-turn Boss.
- Use enabled vocabulary only. Prefer getTopReviewCandidates; avoid last-mission ids when alternatives exist; repair disabled stored ids deterministically.
- Profile switching preserves event, target word id, completed world state, Boss turn, and rewards.
- Speech permission pending, rejection, silence, network failure, and unsupported browsers must leave spelling and typing usable.
- The scene uses at least 60 percent of the first viewport. Do not reuse the magic-gate image as a scene background or place a full-width white task card over it.
- Keep reduced-motion behavior and 72px toddler targets on mobile.
- Every task ends with focused verification and a commit.

---

## File Structure

- Modify: web/src/game/adventure.ts and adventure.test.ts - seeded mission generation, Boss turns, event state, and word repair.
- Create: web/src/persistence/adventureStorage.ts and adventureStorage.test.ts - validated active mission storage.
- Modify: web/src/hooks/useSpeechRecognition.ts and useSpeechRecognition.test.tsx - permission-request lifecycle.
- Modify: web/src/App.tsx and App.test.tsx - resume/new mission, handoff, input behavior, and scene state.
- Modify: web/public/index.html - scene-first desktop/mobile CSS.
- Create: web/public/assets/generated/scene-bramble-grove.png, scene-moon-bridge.png, scene-river-escort.png, scene-thorn-altar.png, companion-scout.png.
- Modify: README.md - relay loop, resume behavior, and microphone instructions.

## Task 1: Deterministic Relay Mission Engine

**Files:**
- Modify: web/src/game/adventure.ts
- Modify: web/src/game/adventure.test.ts

**Interfaces:**
- Consumes: VocabItem, LearningProgressState, getTopReviewCandidates, LearnerProfile.
- Produces: createAdventure(options), getCurrentEvent(state), getCurrentWordId(state), completeChallenge(state), castSpell(state, spell), recordMissionProfile(state, profile), getMissionWordIds(state), repairAdventureWords(state, vocab, progress, now).

- [ ] **Step 1: Replace fixed-room tests with failing seed and relay tests**

~~~ts
const words = ['apple', 'ball', 'cat', 'dog', 'fish', 'heart', 'lion'].map((word) => ({
  id: word, word, imageName: word, difficulty: 1, enabled: true, size: 0, type: '',
}));
const options = { seed: 42, vocab: words, progress: {}, now: 1_700_000_000_000 };

it('creates an equal mission from an equal seed', () => {
  expect(createAdventure(options)).toEqual(createAdventure(options));
  expect(createAdventure(options).events.map((event) => event.kind))
    .toEqual(['escort', 'build', 'scout', 'boss']);
});

it('finishes three shared events and all Boss turns', () => {
  let state = createAdventure(options);
  state = completeChallenge(state);
  state = completeChallenge(state);
  state = completeChallenge(state);
  for (const spell of ['fire', 'shield', 'heal'] as const) {
    state = completeChallenge(state);
    state = castSpell(state, spell).state;
  }
  expect(state.rescued).toBe(true);
});
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run: npm.cmd test -- --runInBand src/game/adventure.test.ts from web/

Expected: FAIL because createAdventure has no options and relay exports do not exist.

- [ ] **Step 3: Implement the smallest mission model**

~~~ts
export type MissionEventKind = 'scout' | 'build' | 'escort' | 'evade' | 'boss';
export type MissionEvent = {
  id: string;
  kind: MissionEventKind;
  wordId?: string;
  bossTurns?: Array<{ intent: BossIntent; spell: Spell; wordId: string }>;
};
export type AdventureState = {
  version: 2;
  seed: number;
  events: MissionEvent[];
  eventIndex: number;
  bossTurn: number;
  spellReady: boolean;
  rescued: boolean;
  rewards: string[];
  modesUsed: LearnerProfile[];
};
~~~

Keep a local seeded 32-bit random generator in adventure.ts. Shuffle scout/build/escort/evade, take three, choose six word ids from review candidates then fallback vocabulary, and append a Boss event containing fire, shield, and heal turns. completeChallenge advances ordinary events and charges a Boss spell; castSpell keeps charge on a wrong spell and advances Boss turns on a correct spell. repairAdventureWords must keep event order and replace only invalid ids.

- [ ] **Step 4: Run focused engine verification**

Run: npm.cmd test -- --runInBand src/game/adventure.test.ts src/game/gameLogic.test.ts from web/

Expected: PASS with deterministic order, no wrong-spell progress loss, word repair, and Boss completion.

- [ ] **Step 5: Commit**

~~~powershell
git add web/src/game/adventure.ts web/src/game/adventure.test.ts
git commit -m "feat: generate deterministic relay missions"
~~~

## Task 2: Validated Mission Resume Storage

**Files:**
- Create: web/src/persistence/adventureStorage.ts
- Create: web/src/persistence/adventureStorage.test.ts

**Interfaces:**
- Consumes: AdventureState from game/adventure.ts.
- Produces: STORAGE_KEY_ADVENTURE, loadAdventureFromStorage(), saveAdventureToStorage(state), clearAdventureFromStorage().

- [ ] **Step 1: Write failing storage tests**

~~~ts
it('returns null for missing, malformed, and invalid storage', () => {
  expect(loadAdventureFromStorage()).toBeNull();
  localStorage.setItem(STORAGE_KEY_ADVENTURE, '{bad-json');
  expect(loadAdventureFromStorage()).toBeNull();
  localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify({ version: 2, events: [] }));
  expect(loadAdventureFromStorage()).toBeNull();
});

it('round-trips a mission without overwriting vocabulary', () => {
  const state = createAdventure(testMissionOptions);
  localStorage.setItem('echoquest_vocab_v1', '[{"word":"apple"}]');
  saveAdventureToStorage(state);
  expect(loadAdventureFromStorage()).toEqual(state);
  clearAdventureFromStorage();
  expect(localStorage.getItem('echoquest_vocab_v1')).toBe('[{"word":"apple"}]');
});
~~~

- [ ] **Step 2: Run the test and verify it fails**

Run: npm.cmd test -- --runInBand src/persistence/adventureStorage.test.ts from web/

Expected: FAIL with Cannot find module ./adventureStorage.

- [ ] **Step 3: Implement strict storage validation**

~~~ts
export const STORAGE_KEY_ADVENTURE = 'echoquest_adventure_v2';

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
~~~

isAdventureState must require version 2, non-empty events, an in-range eventIndex, non-negative bossTurn, booleans for spellReady and rescued, arrays for rewards and modesUsed, wordId on non-Boss events, and exactly three valid Boss turns.

- [ ] **Step 4: Run storage verification**

Run: npm.cmd test -- --runInBand src/persistence/adventureStorage.test.ts src/persistence/progressStorage.test.ts src/persistence/vocabStorage.test.ts from web/

Expected: PASS; corrupt mission data is discarded and vocabulary data survives.

- [ ] **Step 5: Commit**

~~~powershell
git add web/src/persistence/adventureStorage.ts web/src/persistence/adventureStorage.test.ts
git commit -m "feat: persist active relay missions"
~~~

## Task 3: Make Speech Permission Pending Visible

**Files:**
- Modify: web/src/hooks/useSpeechRecognition.ts
- Modify: web/src/hooks/useSpeechRecognition.test.tsx
- Modify: web/src/App.test.tsx

**Interfaces:**
- Consumes: Existing one-shot speech recognition lifecycle.
- Produces: requestingPermission:boolean plus labels 等待麥克風權限, 聆聽中, 說出單字.

- [ ] **Step 1: Add failing pending-state tests**

~~~tsx
fireEvent.click(screen.getByText('start'));
expect(screen.getByTestId('requesting')).toHaveTextContent('true');

act(() => recognition.onstart?.());
expect(screen.getByTestId('requesting')).toHaveTextContent('false');

act(() => recognition.onerror?.({ error: 'not-allowed' }));
expect(screen.getByTestId('requesting')).toHaveTextContent('false');

// App test
fireEvent.click(await screen.findByRole('button', { name: '說出單字' }));
expect(screen.getByRole('button', { name: '等待麥克風權限' })).toBeInTheDocument();
~~~

- [ ] **Step 2: Run speech tests and verify failure**

Run: npm.cmd test -- --runInBand src/hooks/useSpeechRecognition.test.tsx src/App.test.tsx from web/

Expected: FAIL because requestingPermission and its label do not exist.

- [ ] **Step 3: Add one state flag, keeping recognition one-shot**

~~~ts
const [requestingPermission, setRequestingPermission] = useState(false);

// immediately before newRecognition.start()
activeRef.current = true;
setRequestingPermission(true);
newRecognition.start();

newRecognition.onstart = () => {
  setRequestingPermission(false);
  // keep existing listening and transcript updates
};
newRecognition.onerror = () => {
  setRequestingPermission(false);
  // keep existing error updates
};
newRecognition.onend = () => {
  setRequestingPermission(false);
  // keep existing stop updates
};
~~~

Clear the flag in stop() and cleanup. In App choose the label in this order: requestingPermission, then listening, then idle. Keep the microphone control usable so a pending request can be cancelled.

- [ ] **Step 4: Run speech verification**

Run: npm.cmd test -- --runInBand src/hooks/useSpeechRecognition.test.tsx src/App.test.tsx from web/

Expected: PASS; confirmation, error, unsupported, Strict Mode, and stale callback tests still pass.

- [ ] **Step 5: Commit**

~~~powershell
git add web/src/hooks/useSpeechRecognition.ts web/src/hooks/useSpeechRecognition.test.tsx web/src/App.test.tsx
git commit -m "fix: show voice permission request state"
~~~

## Task 4: Generate the First Scene-First Art Pack

**Files:**
- Create: web/public/assets/generated/scene-bramble-grove.png
- Create: web/public/assets/generated/scene-moon-bridge.png
- Create: web/public/assets/generated/scene-river-escort.png
- Create: web/public/assets/generated/scene-thorn-altar.png
- Create: web/public/assets/generated/companion-scout.png

**Interfaces:**
- Consumes: scout, build, escort/evade, and Boss event kinds.
- Produces: four opaque 16:9 background scenes plus one transparent foreground companion.

- [ ] **Step 1: Generate scout and build backgrounds with ImageGen**

Use one image generation per filename:

~~~text
scene-bramble-grove.png: Bright hand-painted 2D children's fantasy game background, wide 16:9, sunlit bramble grove with a clear winding path, room for a character lower left and a glowing route on the right, teal sky, leaf green trees, warm gold stones, clean readable silhouettes, no text, no UI, no border, opaque full background.

scene-moon-bridge.png: Bright hand-painted 2D children's fantasy game background, wide 16:9, broken moonlit wooden bridge over a gentle stream, clear empty gaps where bridge planks can appear, friendly forest banks, room for a companion on the far right, teal blue water, leaf green and gold palette, no text, no UI, no border, opaque full background.
~~~

- [ ] **Step 2: Generate escort, Boss, and companion assets with ImageGen**

~~~text
scene-river-escort.png: Bright hand-painted 2D children's fantasy game background, wide 16:9, shallow river crossing with stepping stones and a safe glowing route, soft forest canopy, readable fallen-branch danger, room for characters in the lower third, no text, no UI, no border, opaque full background.

scene-thorn-altar.png: Bright hand-painted 2D children's fantasy game background, wide 16:9, enchanted thorn altar in a colorful forest clearing, three readable magical danger zones for fire, shield, and healing reactions, empty right-side space for the existing wizard foreground, no text, no UI, no border, opaque full background.

companion-scout.png: Friendly young forest scout companion for a bright hand-painted 2D children's fantasy game, full body, clear silhouette, warm orange and teal clothing, holding a small lantern, transparent background, no text, no border, no crop.
~~~

- [ ] **Step 3: Verify files and build copying**

Run: Get-ChildItem web/public/assets/generated/scene-*.png,web/public/assets/generated/companion-scout.png | Select-Object Name,Length

Expected: Five non-empty files with the planned names.

Run: npm.cmd run build from web/

Expected: PASS and dist/assets/generated contains all five files.

- [ ] **Step 4: Commit**

~~~powershell
git add web/public/assets/generated/scene-bramble-grove.png web/public/assets/generated/scene-moon-bridge.png web/public/assets/generated/scene-river-escort.png web/public/assets/generated/scene-thorn-altar.png web/public/assets/generated/companion-scout.png
git commit -m "feat: add relay rescue scene art"
~~~

## Task 5: Integrate Resume, Handoff, and the Scene-First UI

**Files:**
- Modify: web/src/App.tsx
- Modify: web/src/App.test.tsx
- Modify: web/public/index.html

**Interfaces:**
- Consumes: AdventureState functions, adventureStorage, generated asset paths, and requestingPermission.
- Produces: continue/new mission controls, one shared target across profiles, event-specific world changes, and a bottom relay deck.

- [ ] **Step 1: Add failing integration tests**

~~~tsx
it('offers and restores a saved active build event', async () => {
  localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(buildMission));
  renderGame();
  fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));
  expect(await screen.findByText('魔法建造')).toBeInTheDocument();
  expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'build');
});

it('keeps the active target during a toddler to kid handoff', async () => {
  renderGame();
  fireEvent.click(screen.getByRole('button', { name: /選擇 apple/i }));
  const target = screen.getByTestId('relay-target-word').textContent;
  fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));
  expect(screen.getByTestId('relay-target-word')).toHaveTextContent(target!);
});

it('marks the current scene complete before selecting the next event', async () => {
  setProfile('adult');
  renderGame();
  fireEvent.change(await screen.findByLabelText('Type answer'), { target: { value: 'apple' } });
  fireEvent.click(screen.getByRole('button', { name: '施放路徑魔法' }));
  expect(screen.getByTestId('relay-world')).toHaveAttribute('data-complete', 'true');
});
~~~

- [ ] **Step 2: Run the App test and verify failure**

Run: npm.cmd test -- --runInBand src/App.test.tsx from web/

Expected: FAIL because relay-world, continue controls, and relay action labels do not exist.

- [ ] **Step 3: Replace transient round selection with persisted mission derivation**

~~~ts
const storedMission = loadAdventureFromStorage();
const [adventure, setAdventure] = useState(() =>
  storedMission
    ? repairAdventureWords(storedMission, enabledVocab, progress, Date.now())
    : createAdventure({ seed: Math.floor(Math.random() * 2 ** 31), vocab: enabledVocab, progress, now: Date.now() }),
);
const [showResumePrompt, setShowResumePrompt] = useState(Boolean(storedMission && !storedMission.rescued));
const currentEvent = getCurrentEvent(adventure);
const currentWord = enabledVocab.find((word) => word.id === getCurrentWordId(adventure)) ?? null;
const eventTitle = currentEvent?.kind === 'build' ? '魔法建造'
  : currentEvent?.kind === 'escort' ? '護送前進'
  : currentEvent?.kind === 'evade' ? '避險反制'
  : currentEvent?.kind === 'boss' ? '荊棘救援'
  : '偵察找路';

useEffect(() => {
  saveAdventureToStorage(adventure);
}, [adventure]);
~~~

Remove currentWord, pickWord, and moveToNextWord state transitions. Correct non-Boss answers call completeChallenge. Correct Boss answers charge a spell; castSpell changes the Boss turn. changeProfile records the selected profile, stops speech, and resets only transient fields. startNewMission creates a new seed while passing getMissionWordIds(adventure) as recentWordIds.

Render a resume overlay with 繼續救援 and 新的救援. Render the stable scene-first skeleton below:

~~~tsx
<main className={relayClass} aria-label="EchoQuest family relay rescue">
  <header className="eq-relay-hud">
    <strong>{eventTitle}</strong>
    <span>{adventure.eventIndex + 1} / 4</span>
    <nav aria-label="選擇玩家">
      {learnerProfileOptions.map((option) => (
        <button key={option.value} type="button" aria-pressed={profile === option.value} onClick={() => changeProfile(option.value)}>
          {option.label}
        </button>
      ))}
    </nav>
  </header>
  <section className="eq-relay-world" data-testid="relay-world" data-event={currentEvent?.kind} data-complete={String(eventWasCompleted)}>
    <img className="eq-relay-backdrop" src={sceneForEvent(currentEvent)} alt="" />
    <div className="eq-relay-world-change" aria-hidden="true" />
    <img className="eq-relay-companion" src="/assets/generated/companion-scout.png" alt="" />
    <div className="eq-relay-cue"><span data-testid="relay-target-word">{currentWord?.word}</span></div>
  </section>
  <section className="eq-relay-deck" aria-label="接力操作">
    <p>{profileHints[profile].goal}</p>
    {profile === 'toddler' && <div className="eq-choice-grid">{pictureChoices.map((choice) => <button key={choice.id} type="button" className="eq-picture-choice" onClick={() => submitAnswer(choice.word, 'image_choice')} aria-label={`選擇 ${choice.word}`}><img src={getWordImage(choice)} alt="" /></button>)}</div>}
    {profile === 'kid' && <div className="eq-letter-game"><div aria-label="拼字答案">{selectedLetters || '點字母拼單字'}</div><div className="eq-letter-bank">{letterTiles.map((tile) => <button key={tile.id} type="button" disabled={tile.used} onClick={() => selectLetter(tile.id)} aria-label={`letter ${tile.letter}`}>{tile.letter}</button>)}</div><button type="button" onClick={() => submitAnswer(selectedLetters, 'spelling')}>{submitLabel}</button></div>}
    {profile === 'adult' && <form className="eq-typing-game" onSubmit={(event) => { event.preventDefault(); submitAnswer(typedAnswer, 'spelling'); }}><input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} aria-label="Type answer" /><button type="submit">{submitLabel}</button></form>}
  </section>
</main>
~~~

For kid spelling, accept only the next correct character; derive bridge/rune visibility from selectedLetters length, clear on a wrong letter, and show the next character hint. Toddler and adult correct answers complete the same event immediately.

- [ ] **Step 4: Replace fixed-card CSS with responsive scene and deck CSS**

~~~css
.eq-relay { min-height:100dvh; color:var(--forest-ink); background:#163f40; }
.eq-relay-world { position:relative; min-height:62dvh; overflow:hidden; }
.eq-relay-backdrop { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.eq-relay-world-change { position:absolute; inset:auto 18% 19% 18%; min-height:46px; }
.eq-relay--build .eq-relay-world-change { background:repeating-linear-gradient(90deg,#e9bc61 0 54px,transparent 54px 66px); }
.eq-relay-deck { position:fixed; z-index:20; inset:auto 0 0; min-height:144px; padding:12px max(14px,calc((100vw - 960px)/2)); background:#f7fff9; }
@media (max-width:640px) {
  .eq-relay-world { min-height:56dvh; }
  .eq-relay-deck { min-height:188px; padding:10px 14px; }
  .eq-picture-choice { min-height:72px; }
}
~~~

Replace the old world challenge, portal, and fixed spell-dock styles rather than layering cards over them. Preserve focus-visible and reduced-motion rules.

- [ ] **Step 5: Run integration tests and build**

Run: npm.cmd test -- --runInBand src/App.test.tsx src/game/adventure.test.ts src/persistence/adventureStorage.test.ts from web/

Expected: PASS; resume restores the exact event, handoff preserves the target, and scene completion is visible.

Run: npm.cmd run build from web/

Expected: PASS with all relay assets copied to dist.

- [ ] **Step 6: Commit**

~~~powershell
git add web/src/App.tsx web/src/App.test.tsx web/public/index.html
git commit -m "feat: build scene-first family relay rescue"
~~~

## Task 6: Document and Verify the Vertical Slice

**Files:**
- Modify: README.md

**Interfaces:**
- Consumes: the completed relay mission, resume controls, and speech lifecycle.
- Produces: accurate run instructions and reproducible browser evidence.

- [ ] **Step 1: Update README behavior and voice instructions**

Add this section and replace the fixed three-room loop:

~~~md
## Family Relay Rescue

- A mission seed chooses three rescue events, Boss hazards, and vocabulary.
- Switch 2y 圖像, 5y 單字, and 成人/家長 at any point; target words and world progress stay shared.
- Correct answers visibly change the scene. Restarting the page offers 繼續救援 for an unfinished mission.
- 新的救援 creates a different seeded event and vocabulary plan.
~~~

Document the voice sequence 等待麥克風權限 -> 聆聽中 -> 聽到 -> 確認送出 and state that denial leaves spelling/typing active.

- [ ] **Step 2: Run all automated checks**

Run: npm.cmd test -- --runInBand from web/

Expected: all suites PASS.

Run: npm.cmd run build from web/

Expected: PASS.

Run: git diff --check from repository root.

Expected: no output.

- [ ] **Step 3: Run desktop Chrome CDP live playtest**

Use an isolated CDP browser against the served game:

~~~powershell
node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs spawn-debug-browser edge --port 9222 --url http://127.0.0.1:8000/
$env:CDP_PORT='9222'
node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs list
$target = (node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs list | Select-String 'EchoQuest' | ForEach-Object { ($_ -split '\s+')[0] })
node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs perceive $target -C -d 8
~~~

Complete one event as 2y, hand off to 5y, play one adult Boss turn, reload, choose 繼續救援, and confirm perceive reports the same event and target word. Save one desktop elshot of main.

- [ ] **Step 4: Run mobile and microphone checks**

~~~powershell
node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs viewport $target 390x844
node C:\Users\endea\.codex\skills\chrome-cdp-ex\scripts\cdp.mjs perceive $target -C -d 8
~~~

Verify scene cue and active action appear above the bottom deck with no horizontal overflow. In an actual Chrome or Edge window, allow microphone once and verify 等待麥克風權限 -> 聆聽中 -> 聽到 -> 確認送出; then deny/cancel once and verify spelling/typing remains active.

- [ ] **Step 5: Commit documentation**

~~~powershell
git add README.md
git commit -m "docs: explain family relay rescue"
~~~

## Plan Self-Review

- Spec coverage: Task 1 implements seeded missions, random variety, shared state, Boss turns, and word repair. Task 2 implements exact resume and corrupt storage recovery. Task 3 adds the CDP-observed permission-pending state. Task 4 supplies the approved art. Task 5 implements the scene-first handoff UI. Task 6 covers docs, desktop/mobile CDP, real microphone, build, and diff verification.
- Placeholder scan: each task lists exact files, interfaces, test content, commands, expected outcomes, and commit messages.
- Type consistency: AdventureState, MissionEvent, createAdventure, completeChallenge, getCurrentEvent, getCurrentWordId, repairAdventureWords, STORAGE_KEY_ADVENTURE, and requestingPermission are defined before Task 5 consumes them.
