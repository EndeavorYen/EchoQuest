# EchoQuest

> **TL;DR** — EchoQuest is a local-first family English game. A toddler, early reader, and adult can take turns inside one shared rescue mission without losing the current word or progress.

EchoQuest is a local-first English learning adventure game for a family audience: toddlers, young kids, and adults share the same vocabulary and quest content while playing through different challenge modes.

## Family Relay Rescue

- A mission seed chooses three rescue events, Boss hazards, and vocabulary.
- Switch `2y 圖像`, `5y 單字`, and `成人/家長` at any point; the target word and world progress stay shared.
- Correct answers visibly change the scene, then the mission advances automatically.
- During the Boss event, answer the word to charge magic, read the danger hint, then choose fire, shield, or healing.
- Reloading an unfinished mission offers `繼續救援`; `新的救援` creates a different event and vocabulary plan.
- Missed or weak words are stored in browser `localStorage` and prioritized for review.

## Learner Profiles

| Profile | Intended Player | Challenge Style |
| --- | --- | --- |
| `2y 圖像` | toddler / pre-reader | choose the matching picture; wrong answers do not cost hearts |
| `5y 單字` | early reader | tap letter tiles to assemble the English word; optional voice input is available |
| `成人/家長` | adult practice | fast typing practice; optional voice input is available |

Progress is stored in browser `localStorage`, including the exact active mission, vocabulary, learner profile, recognition language, and per-word mastery.

## Family Vocabulary Library

Open the library with the settings button to search, filter, edit, enable, or remove words. Image and folder imports skip duplicate words case-insensitively and report added, skipped, and failed files inline without interrupting play.

## Voice Input

Voice is implemented as a safe optional input path:

- Click `說出單字`; while the browser asks for access, the button shows `等待麥克風權限`.
- After permission is granted, the button shows `聆聽中`.
- Speak the English word shown by the picture.
- EchoQuest displays `聽到：...` for review.
- Click `確認送出` to use the answer, or `重試` to listen again.

If speech recognition is unsupported, blocked by microphone permission, or temporarily unavailable, the app keeps the spelling/typing controls usable. For the best chance of voice support, run in Chrome or Edge from `localhost` or HTTPS and allow microphone access when prompted.

If permission was denied, open the site's microphone settings from the address bar, allow access, and reload. On Windows, also enable microphone access for desktop apps under **Settings > Privacy & security > Microphone**.

## Development

```powershell
cd web
npm install
npm test -- --runInBand
npm run build
npm start
```

`npm start` prints a local URL such as `http://127.0.0.1:8000` or `http://localhost:8000`. Open that URL in Chrome or Edge to play and test microphone input.

The app uses React 18, TypeScript, Jest, esbuild, and static generated PNG assets under `web/public/assets/generated/`.

## Verification

Before merging gameplay changes, run:

```powershell
cd web
npm test -- --runInBand
npm run build
```

From the repository root:

```powershell
git diff --check
```

## Design Notes

The current relay design and implementation plan live at:

- `docs/superpowers/specs/2026-07-11-family-relay-rescue-design.md`
- `docs/superpowers/plans/2026-07-11-family-relay-rescue.md`
