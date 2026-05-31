# Voice Practice Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voice input a guided pronunciation practice flow where final recognition results are reviewed, retried, or confirmed before gameplay submission.

**Architecture:** Keep the gameplay reducer unchanged for this first PR and add the review phase at the `App` interaction boundary. `useSpeechRecognition` remains responsible for browser recognition lifecycle; `App` owns whether a final transcript is accepted into the game.

**Tech Stack:** React 18, TypeScript, Jest, Testing Library, Web Speech API mock.

---

### Task 1: App Voice Review Flow

**Files:**
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`

- [x] **Step 1: Write failing tests for review-first voice submission**

```tsx
it('reviews final speech recognition results before submitting them', async () => {
  render(<App initialVocab={defaultTestVocab} />);
  fireEvent.click(screen.getByText('開始遊戲'));

  await waitFor(() => {
    expect(screen.getByText('關卡 1')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('點擊說話'));
  const recognition = MockSpeechRecognition.instances[0];

  act(() => {
    recognition.onstart?.();
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
    });
  });

  expect(screen.getByText('聽到：apple')).toBeInTheDocument();
  expect(screen.getByText('目標：apple')).toBeInTheDocument();
  expect(screen.getByText('分數: 0')).toBeInTheDocument();
  expect(screen.queryByText(/太棒了!/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /確認送出/i }));

  await waitFor(() => {
    expect(screen.getByText(/太棒了! \+10 分，對怪物造成 1 點傷害!/)).toBeInTheDocument();
  });
  expect(screen.getByText('分數: 10')).toBeInTheDocument();
});
```

- [x] **Step 2: Run the focused failing test**

Run: `npm test -- App.test.tsx --runInBand`
Expected: FAIL because `聽到：apple` and `確認送出` do not exist, and speech currently submits immediately.

- [x] **Step 3: Implement minimal review state in App**

Add local state:

```tsx
type VoiceReviewResult = {
  heardText: string;
  targetWord: string;
  isMatch: boolean;
};
```

Use `useState<VoiceReviewResult | null>(null)`. In `onResult`, when the game is playing in voice mode and there is no pending review, set review state instead of calling `handleSubmitRef.current`.

- [x] **Step 4: Render review controls**

In the voice UI, render:

```tsx
{voiceReview && (
  <div className="eq-voice-review" role="status" aria-live="polite">
    <p>聽到：{voiceReview.heardText}</p>
    <p>目標：{voiceReview.targetWord}</p>
    <p>{voiceReview.isMatch ? '聽起來很接近，確認後發動攻擊。' : '還沒聽準，可以重試一次。'}</p>
    <QuestButton onClick={retryVoiceReview}>重試語音</QuestButton>
    <QuestButton onClick={confirmVoiceReview}>確認送出</QuestButton>
  </div>
)}
```

- [x] **Step 5: Run the focused test to verify green**

Run: `npm test -- App.test.tsx --runInBand`
Expected: PASS for the updated App tests.

### Task 2: Retry, Late Result, and Error Recovery

**Files:**
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`

- [x] **Step 1: Write failing tests for retry and late-result safety**

Add tests that assert:
- Clicking `重試語音` clears the review result and starts listening again.
- A second final speech event while the first result is pending review does not replace the pending transcript or submit damage.
- Switching to spelling mode clears pending voice review.

- [x] **Step 2: Run the focused failing tests**

Run: `npm test -- App.test.tsx --runInBand`
Expected: FAIL because retry and late-result guards are not implemented yet.

- [x] **Step 3: Implement retry and stale-result guards**

Use refs for current acceptance and pending review:

```tsx
const voiceReviewRef = useRef<VoiceReviewResult | null>(null);
voiceReviewRef.current = voiceReview;
acceptSpeechResultsRef.current = gameState === 'playing' && practiceMode === 'voice' && !voiceReview;
```

Implement `retryVoiceReview` to clear review, reset transcript, clear speech error, and call `speech.start(recognitionLang)`. Clear review when changing word, changing practice mode, skipping, or confirming.

- [x] **Step 4: Run focused tests**

Run: `npm test -- App.test.tsx --runInBand`
Expected: PASS.

### Task 3: Verification and PR

**Files:**
- Modify: `docs/superpowers/plans/2026-05-31-voice-practice-flow.md`
- Modify: changed source/tests from prior tasks

- [x] **Step 1: Run full tests**

Run: `npm test -- --runInBand`
Expected: all Jest suites pass.

- [x] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript and esbuild finish with exit code 0.

- [x] **Step 3: Check whitespace**

Run: `git diff --check`
Expected: no whitespace errors.

- [x] **Step 4: Review diff**

Run: `git diff --stat main...HEAD` and inspect the changed files for accidental scope creep.

- [ ] **Step 5: Commit and open PR**

Commit message:

```text
feat: add guided voice practice review flow

Constraint: Keep gameplay reducer unchanged for first voice-flow PR
Confidence: high
Scope-risk: moderate
```

Open a PR to `main` referencing issue `#56`.
