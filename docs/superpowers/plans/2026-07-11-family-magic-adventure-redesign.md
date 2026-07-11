# EchoQuest Family Magic Adventure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one complete 5–8 minute “Forest Rescue” adventure that a toddler, early reader, and adult can finish together, with reliable optional voice input.

**Architecture:** Keep the existing React application, vocabulary data, learning progress, localStorage, and Web Speech hook. Add one small pure adventure state module, then let `App.tsx` render the three room-specific interactions and scene-first UI; no game engine or new state framework is introduced.

**Tech Stack:** React 18, TypeScript 5, Jest, Testing Library, esbuild, native Web Speech API, existing generated PNG assets.

## Global Constraints

- The first delivery is one complete Forest Rescue mission, not a content platform or multiple maps.
- The shared family adventure has three rooms: orchard exploration, bridge repair, and wizard rescue.
- `2y 圖像`, `5y 單字`, and `成人/家長` use the same room state with age-appropriate answer controls.
- Voice is optional, one-shot, confirmed before submission, and never blocks picture, spelling, or typing input.
- No new runtime dependency, game engine, backend, account system, cloud sync, or state framework.
- Desktop and 390×844 mobile must show the mission, scene, and primary action without horizontal overflow.
- Existing unrelated worktree changes must be preserved and never reverted.

---

### Task 1: Track and Model the Forest Rescue Mission

**Files:**
- Create: `web/src/game/adventure.ts`
- Create: `web/src/game/adventure.test.ts`
- Modify: `progress.md`

**Interfaces:**
- Consumes: no application state; this module is pure.
- Produces: `AdventureState`, `AdventureRoom`, `BossIntent`, `Spell`, `createAdventure()`, `completeRoomChallenge()`, and `castSpell()`.

- [ ] **Step 1: Open one GitHub tracking issue with exact acceptance criteria**

Run from the repository root:

```powershell
$body = @'
## Forest Rescue vertical slice

- [ ] Orchard, bridge, and rescue rooms form one complete mission
- [ ] 2y picture, 5y spelling, and adult typing inputs share mission progress
- [ ] Fire, shield, and heal each counter a visible wizard intent
- [ ] Voice handles permission denial, silence, retry, confirmation, stale results, and fallback
- [ ] Desktop and 390x844 browser playthroughs pass without overflow or console errors
- [ ] Jest, TypeScript build, README, and progress notes pass review

This issue closes only after all checks have evidence in the closing comment.
'@
gh issue create --title "Rebuild EchoQuest as a family magic adventure" --body $body
```

Expected: one issue URL on the current GitHub repository.

- [ ] **Step 2: Write the failing adventure state tests**

Create `web/src/game/adventure.test.ts`:

```ts
import { castSpell, completeRoomChallenge, createAdventure } from './adventure';

describe('forest rescue adventure', () => {
  it('moves orchard to bridge, bridge to rescue, and rescue to victory', () => {
    let state = createAdventure();
    state = completeRoomChallenge(state);
    expect(state.room).toBe('bridge');
    state = completeRoomChallenge(state);
    expect(state.room).toBe('rescue');

    state = castSpell(state, 'fire').state;
    state = castSpell(state, 'shield').state;
    state = castSpell(state, 'heal').state;
    expect(state.room).toBe('complete');
    expect(state.rescued).toBe(true);
  });

  it('keeps the same boss turn and returns a hint for the wrong spell', () => {
    const rescue = { ...createAdventure(), room: 'rescue' as const };
    const result = castSpell(rescue, 'heal');
    expect(result.correct).toBe(false);
    expect(result.state.bossTurn).toBe(0);
    expect(result.hint).toBe('荊棘怕火焰。');
  });
});
```

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```powershell
cd web
npm test -- src/game/adventure.test.ts --runInBand
```

Expected: FAIL because `./adventure` does not exist.

- [ ] **Step 4: Implement the minimal pure adventure state**

Create `web/src/game/adventure.ts`:

```ts
export type AdventureRoom = 'orchard' | 'bridge' | 'rescue' | 'complete';
export type BossIntent = 'thorns' | 'falling_branch' | 'curse';
export type Spell = 'fire' | 'shield' | 'heal';

export type AdventureState = {
  room: AdventureRoom;
  bossTurn: number;
  rescued: boolean;
  rewards: string[];
};

const bossTurns: Array<{ intent: BossIntent; spell: Spell; hint: string }> = [
  { intent: 'thorns', spell: 'fire', hint: '荊棘怕火焰。' },
  { intent: 'falling_branch', spell: 'shield', hint: '用護盾擋住落下的樹枝。' },
  { intent: 'curse', spell: 'heal', hint: '治療魔法可以解除詛咒。' },
];

export function createAdventure(): AdventureState {
  return { room: 'orchard', bossTurn: 0, rescued: false, rewards: [] };
}

export function completeRoomChallenge(state: AdventureState): AdventureState {
  if (state.room === 'orchard') return { ...state, room: 'bridge', rewards: [...state.rewards, 'healing-apple'] };
  if (state.room === 'bridge') return { ...state, room: 'rescue', rewards: [...state.rewards, 'bridge-star'] };
  return state;
}

export function getBossTurn(state: AdventureState) {
  return bossTurns[Math.min(state.bossTurn, bossTurns.length - 1)];
}

export function castSpell(state: AdventureState, spell: Spell) {
  const turn = getBossTurn(state);
  if (state.room !== 'rescue' || spell !== turn.spell) {
    return { state, correct: false, hint: turn.hint };
  }

  const bossTurn = state.bossTurn + 1;
  return bossTurn === bossTurns.length
    ? { state: { ...state, room: 'complete' as const, bossTurn, rescued: true, rewards: [...state.rewards, 'forest-wizard'] }, correct: true, hint: '' }
    : { state: { ...state, bossTurn }, correct: true, hint: '' };
}
```

- [ ] **Step 5: Run focused tests and update progress**

Run:

```powershell
npm test -- src/game/adventure.test.ts --runInBand
```

Expected: PASS, 2 tests.

Append to `progress.md`: issue URL, domain functions, focused test result, and the self-review note “three fixed boss turns are sufficient for the first vertical slice.”

- [ ] **Step 6: Commit Task 1**

```powershell
git add web/src/game/adventure.ts web/src/game/adventure.test.ts progress.md
git commit -m "feat: model forest rescue adventure"
```

---

### Task 2: Replace the Dashboard Loop with Three Playable Rooms

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/public/index.html`

**Interfaces:**
- Consumes: Task 1 `AdventureState`, `createAdventure()`, `completeRoomChallenge()`, `getBossTurn()`, and `castSpell()`.
- Produces: room-specific DOM labels `果園探索`, `修復魔法橋`, `森林救援`; spell buttons with accessible names `火球`, `護盾`, `治療`; shared player switching.

- [ ] **Step 1: Replace combat-score tests with one full family mission test**

Add this scenario to `web/src/App.test.tsx`, using the existing mocked speech hook and deterministic one-item vocabulary fixture:

```tsx
it('lets the family finish orchard, bridge, and rescue rooms together', async () => {
  render(<App initialVocab={testVocab} initialLevels={testLevels} />);

  expect(screen.getByRole('heading', { name: '果園探索' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /選擇 apple/i }));

  expect(screen.getByRole('heading', { name: '修復魔法橋' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));
  for (const letter of ['a', 'p', 'p', 'l', 'e']) {
    const tile = screen.getAllByRole('button', { name: `letter ${letter}` })
      .find((button) => !(button as HTMLButtonElement).disabled);
    fireEvent.click(tile!);
  }
  fireEvent.click(screen.getByRole('button', { name: '修好橋梁' }));

  expect(screen.getByRole('heading', { name: '森林救援' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '成人/家長' }));
  for (const spell of ['火球', '護盾', '治療']) {
    fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '魔法充能' }));
    fireEvent.click(screen.getByRole('button', { name: spell }));
  }
  expect(screen.getByRole('heading', { name: '救援成功' })).toBeInTheDocument();
});
```

Keep focused existing tests for toddler wrong-choice safety, kid tile clearing, adult typing, voice confirmation, and unsupported voice fallback. Delete assertions tied only to boss HP, score, hearts, or Echo energy.

- [ ] **Step 2: Run the App test and verify failure**

Run:

```powershell
npm test -- src/App.test.tsx --runInBand
```

Expected: FAIL because the room headings and `修好橋梁` action do not exist.

- [ ] **Step 3: Wire the adventure state into `App.tsx`**

Import the Task 1 API and replace `bossHp`, `score`, `streak`, `energy`, `hearts`, and level-completion state with:

```ts
const [adventure, setAdventure] = useState(createAdventure);
const [spellReady, setSpellReady] = useState(false);
const bossTurn = adventure.room === 'rescue' ? getBossTurn(adventure) : null;

const finishLearningChallenge = () => {
  setAdventure((state) => completeRoomChallenge(state));
};

const useSpell = (spell: Spell) => {
  if (!spellReady) return;
  setAdventure((state) => {
    const result = castSpell(state, spell);
    if (result.correct) setSpellReady(false);
    setMessage({
      kind: result.correct ? 'correct' : 'wrong',
      text: result.correct ? '魔法成功！' : result.hint,
    });
    return result.state;
  });
};
```

Correct orchard answers call `finishLearningChallenge()`. Correct bridge spelling or typing calls `finishLearningChallenge()`. In the rescue room, a correct picture, spelling, typing, or confirmed voice answer calls `setSpellReady(true)` instead of advancing the room and changes the submit label to `魔法充能`. Spell buttons use `disabled={!spellReady}`. A correct spell advances the boss turn and requires a new learning answer; a wrong spell keeps the charge, displays the intent hint, and never resets the room.

- [ ] **Step 4: Replace the main render with the scene-first room structure**

Add the exact room copy beside `profileHints`:

```ts
const roomViews: Record<AdventureRoom, { number: number; kicker: string; title: string; instruction: string }> = {
  orchard: { number: 1, kicker: 'ROOM 1 · 探索', title: '果園探索', instruction: '找到蘋果，取得治療魔法。' },
  bridge: { number: 2, kicker: 'ROOM 2 · 修復', title: '修復魔法橋', instruction: '完成單字，讓每個字母變成橋板。' },
  rescue: { number: 3, kicker: 'ROOM 3 · 救援', title: '森林救援', instruction: '先完成學習挑戰充能，再觀察意圖選魔法。' },
  complete: { number: 3, kicker: 'QUEST CLEAR', title: '救援成功', instruction: '森林巫師加入家庭收藏。' },
};
```

Use one `main.eq-adventure` with this hierarchy in `App.tsx`. `roomView` is `roomViews[adventure.room]`. Inline the existing `learnerProfileOptions.map(...)` profile buttons in the `nav`. Move the current four tested control blocks beginning with `profile === 'toddler'`, `profile === 'kid'`, `profile === 'adult'`, and `canUseVoice` unchanged inside `.eq-world-challenge`; only change the bridge submit label to `修好橋梁` and the rescue submit label to `魔法充能`.

```tsx
<main className={`eq-adventure eq-adventure--${adventure.room} eq-adventure--${profile}`}>
  <header className="eq-adventure-hud">
    <div><span>森林救援</span><strong>{roomView.number}/3</strong></div>
    <nav aria-label="選擇玩家">
      {learnerProfileOptions.map((option) => (
        <button key={option.value} aria-pressed={profile === option.value} onClick={() => changeProfile(option.value)}>
          {option.label}
        </button>
      ))}
    </nav>
  </header>
  <section className="eq-adventure-scene" aria-live="polite">
    <div className="eq-scene-copy">
      <p>{roomView.kicker}</p>
      <h1>{roomView.title}</h1>
      <p>{roomView.instruction}</p>
    </div>
    <div className="eq-scene-character">
      <img src={adventure.room === 'rescue' ? '/assets/generated/boss-wizard.png' : '/assets/generated/level-magic-gate.png'} alt="" />
    </div>
    <div className="eq-world-challenge" />
  </section>
  {adventure.room === 'rescue' && (
    <div className="eq-spell-dock" aria-label="可用魔法">
      <button disabled={!spellReady} onClick={() => useSpell('fire')}>火球</button>
      <button disabled={!spellReady} onClick={() => useSpell('shield')}>護盾</button>
      <button disabled={!spellReady} onClick={() => useSpell('heal')}>治療</button>
    </div>
  )}
</main>
```

The self-closing `.eq-world-challenge` line in the structural snippet becomes the container for the existing profile and voice control blocks described immediately above; it is shown empty only to keep the unchanged control markup from being duplicated in this plan.

Derive the three room titles and instructions directly in `App.tsx`; do not add a configuration framework. Keep vocabulary management behind one compact parent button. Keep profile switching visible, but hide learning statistics and settings from the playfield.

- [ ] **Step 5: Replace the old dashboard CSS with the approved visual direction**

In `web/public/index.html`, keep the reset, font loading, focus-visible, and reduced-motion rules. Replace `.eq-arcade-*`, boss panel, stat grid, and learning summary layout rules with:

```css
:root {
  --forest-ink: #17233b;
  --forest-leaf: #2f8f67;
  --forest-sun: #ffcf5a;
  --forest-coral: #ef624d;
  --forest-sky: #99d8df;
}
.eq-adventure { min-height:100dvh; color:var(--forest-ink); background:#dff0dd; overflow:hidden; }
.eq-adventure-hud { position:fixed; z-index:20; inset:16px 16px auto; display:flex; justify-content:space-between; pointer-events:none; }
.eq-adventure-hud > * { pointer-events:auto; }
.eq-adventure-scene { position:relative; min-height:100dvh; padding:104px clamp(20px,5vw,72px) 136px; background:center/cover no-repeat url('/assets/generated/level-magic-gate.png'); }
.eq-scene-copy { position:relative; z-index:2; max-width:430px; color:#fff; text-shadow:0 2px 12px rgba(23,35,59,.72); }
.eq-scene-character { position:absolute; right:4vw; bottom:110px; width:min(44vw,560px); }
.eq-world-challenge { position:absolute; z-index:3; left:5vw; bottom:120px; max-width:min(520px,90vw); }
.eq-spell-dock { position:fixed; z-index:30; inset:auto 50% 18px auto; transform:translateX(50%); display:grid; grid-template-columns:repeat(3,minmax(92px,150px)); gap:10px; }
.eq-spell-dock button { min-height:64px; border:0; border-radius:12px; font-weight:900; box-shadow:inset 0 -5px rgba(0,0,0,.18),0 8px 20px rgba(23,35,59,.25); }
@media (max-width:640px) {
  .eq-adventure-hud { inset:8px; }
  .eq-adventure-scene { padding:82px 14px 164px; }
  .eq-scene-character { right:-14vw; bottom:190px; width:78vw; opacity:.9; }
  .eq-world-challenge { left:14px; right:14px; bottom:92px; max-width:none; }
  .eq-spell-dock { inset:auto 8px 8px; transform:none; grid-template-columns:repeat(3,1fr); }
  .eq-spell-dock button, .eq-picture-choice { min-height:72px; }
}
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; } }
```

Keep existing generated PNGs; do not generate a second asset set until this playable slice passes review.

- [ ] **Step 6: Run focused UI tests**

Run:

```powershell
npm test -- src/App.test.tsx src/game/adventure.test.ts --runInBand
```

Expected: PASS for the full family mission and focused input regressions.

- [ ] **Step 7: Commit Task 2**

```powershell
git add web/src/App.tsx web/src/App.test.tsx web/public/index.html
git commit -m "feat: build playable forest rescue mission"
```

---

### Task 3: Make Voice Input Reliable and Non-Blocking

**Files:**
- Modify: `web/src/hooks/useSpeechRecognition.ts`
- Modify: `web/src/hooks/useSpeechRecognition.test.tsx`
- Modify: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: browser `SpeechRecognition` or `webkitSpeechRecognition`.
- Produces: hook API `start(lang)`, `stop()`, `resetTranscript()`, `clearError()`, `listening`, `isSupported`, `error`, `transcript`, and `interimTranscript`; removes the unused `autoRestart` option.

- [ ] **Step 1: Add lifecycle regression tests before changing the hook**

Add a stop button to the existing `ResultHarness`:

```tsx
function ResultHarness({ onResult }: { onResult: (result: string) => void }) {
  const speech = useSpeechRecognition({ onResult });
  return (
    <div>
      <button onClick={() => speech.start('en-US')}>start</button>
      <button onClick={speech.stop}>stop</button>
    </div>
  );
}
```

Delete `AutoRestartHarness` and its automatic-restart test because no application caller uses that option. Add these lifecycle tests using the existing `MockSpeechRecognition`:

```tsx
it('does not restart after no-speech or after unmount', () => {
  setMockSpeechRecognition();
  const { unmount } = render(<ResultHarness onResult={jest.fn()} />);
  fireEvent.click(screen.getByText('start'));
  const recognition = MockSpeechRecognition.instances[0];
  act(() => recognition.onerror?.({ error: 'no-speech' }));
  expect(recognition.start).toHaveBeenCalledTimes(1);
  const ended = recognition.onend;
  unmount();
  act(() => ended?.());
  expect(recognition.start).toHaveBeenCalledTimes(1);
});

it('ignores a final result produced after stop', () => {
  setMockSpeechRecognition();
  const onResult = jest.fn();
  render(<ResultHarness onResult={onResult} />);
  fireEvent.click(screen.getByText('start'));
  const recognition = MockSpeechRecognition.instances[0];
  fireEvent.click(screen.getByText('stop'));
  act(() => recognition.onresult?.({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: 'apple' } }],
  }));
  expect(onResult).not.toHaveBeenCalled();
});
```

In `web/src/App.test.tsx`, keep the confirmed result test and add: switching player or advancing room clears the visible transcript and prevents the old result from completing the next challenge.

- [ ] **Step 2: Run speech tests and verify the stale-result test fails if the bug exists**

Run:

```powershell
npm test -- src/hooks/useSpeechRecognition.test.tsx src/App.test.tsx --runInBand
```

Expected before the fix: at least the stale-result lifecycle assertion fails; if all pass, retain the tests and do not rewrite working hook code.

- [ ] **Step 3: Apply the smallest lifecycle fix required by the failing test**

Remove `autoRestart` from `UseSpeechRecognitionOptions`, function arguments, refs, effects, and `onend`. Keep recognition one-shot:

```ts
newRecognition.continuous = false;
newRecognition.interimResults = true;
```

Guard callbacks with refs owned by the hook:

```ts
const activeRef = useRef(false);
const mountedRef = useRef(true);

newRecognition.onresult = (event) => {
  if (!mountedRef.current || !activeRef.current) return;
  let finalTranscript = '';
  let interim = '';
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    const value = result?.[0]?.transcript ?? '';
    if (result?.isFinal) finalTranscript += value;
    else interim += value;
  }
  if (finalTranscript) {
    const normalized = finalTranscript.trim();
    setTranscript((previous) => `${previous} ${normalized}`.trim());
    onResultRef.current?.(normalized);
  }
  setInterimTranscript(interim);
};
newRecognition.onerror = (event) => {
  activeRef.current = false;
  setListening(false);
  setError(event.error);
};
newRecognition.onend = () => {
  activeRef.current = false;
  if (mountedRef.current) setListening(false);
};
```

`start()` sets `activeRef.current = true` immediately before `recognition.start()`. `stop()` sets it to false before `recognition.stop()`. Cleanup sets `mountedRef.current = false`, sets active false, clears handlers, and calls `stop()` once with `abort()` as the exception fallback. Do not add auto-restart, timers, or a backend service.

- [ ] **Step 4: Verify all speech and App tests**

Run:

```powershell
npm test -- src/hooks/useSpeechRecognition.test.tsx src/App.test.tsx --runInBand
```

Expected: PASS for support detection, permission error, no-speech, retry, stop, unmount, confirmed result, stale result, and unsupported fallback.

- [ ] **Step 5: Commit Task 3**

```powershell
git add web/src/hooks/useSpeechRecognition.ts web/src/hooks/useSpeechRecognition.test.tsx web/src/App.test.tsx
git commit -m "fix: make voice casting one-shot and reliable"
```

---

### Task 4: Playtest, Document, and Resolve the Tracking Issue

**Files:**
- Modify: `README.md`
- Modify: `progress.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the complete mission from Tasks 1–3.
- Produces: verified local run instructions, voice troubleshooting, visual evidence, and a closed redesign tracking issue.

- [ ] **Step 1: Run the complete automated verification**

Run:

```powershell
cd web
npm test -- --runInBand
npm run build
cd ..
git diff --check
```

Expected: all Jest suites pass, TypeScript/esbuild complete successfully, and diff check reports no whitespace errors.

- [ ] **Step 2: Serve the production build and complete desktop playthrough**

Serve `web/dist` over HTTP, then use Playwright at 1365×900 to:

1. Complete orchard as `2y 圖像`.
2. Switch to `5y 單字` and repair the bridge.
3. Enter rescue, answer a learning challenge to charge each spell, intentionally choose one wrong spell, verify the charge and room remain, then cast fire → shield → heal.
4. Verify the victory reward appears.
5. Record console errors and capture orchard, bridge, rescue, and victory screenshots.

Expected: complete mission, no uncaught console error, and wrong spell only shows a hint.

- [ ] **Step 3: Complete mobile and voice playthroughs**

At 390×844, repeat the mission and measure:

```js
({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  actionBottom: document.querySelector('.eq-world-challenge')?.getBoundingClientRect().bottom,
  viewport: window.innerHeight,
})
```

Expected: `overflow` is `false`, task and primary action are visible or reachable without an unrelated panel blocking them, and each toddler target is at least 72px tall.

In Chrome or Edge on localhost, manually verify microphone permission, one-shot recognition, visible transcript confirmation, retry, cancellation, and typing fallback after denial. Browser automation covers unsupported/fake recognition; real microphone permission requires this manual pass.

- [ ] **Step 4: Update documentation and ignore visual-companion scratch files**

Add `.superpowers/` to `.gitignore`. Update `README.md` with:

- the Forest Rescue three-room loop;
- how each age profile contributes;
- `cd web`, `npm install`, `npm start`, and the printed localhost URL;
- Chrome/Edge microphone permission and fallback steps;
- `npm test -- --runInBand` and `npm run build` verification commands.

Append all test counts, build result, screenshot viewport results, console status, and real-microphone result to `progress.md`.

- [ ] **Step 5: Close the tracking issue only after every checkbox passes**

Run:

```powershell
$issue = gh issue list --state open --search '"Rebuild EchoQuest as a family magic adventure" in:title' --json number --jq '.[0].number'
$comment = @'
Resolved with evidence:
- Complete orchard → bridge → rescue → victory playthrough
- Toddler, kid, and adult inputs verified
- Voice lifecycle and fallback tests pass
- Desktop 1365x900 and mobile 390x844 visual checks pass
- Full Jest suite and production build pass
- README and progress notes updated
'@
gh issue close $issue --comment $comment
gh issue view $issue --json state,title,url
```

Expected: the issue state is `CLOSED`. If a check fails, leave the issue open, fix the failure, and rerun the relevant verification first.

- [ ] **Step 6: Commit Task 4**

```powershell
git add .gitignore README.md progress.md
git commit -m "docs: verify forest rescue release"
```

- [ ] **Step 7: Final branch verification and publish**

Run:

```powershell
git status --short --branch
git log -5 --oneline
git push origin main
```

Expected: no redesign issue remains open, the branch is pushed, and `main` matches `origin/main` for the completed commits.
