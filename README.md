# EchoQuest

EchoQuest is a local-first English learning adventure game for a family audience: toddlers, young kids, and adults share the same vocabulary and quest content while playing through different challenge modes.

## Current Game Loop

- Open the app and pick a learner profile from the top of the play screen.
- Complete one shared family mission: explore the orchard, repair the magic bridge, then rescue the forest wizard.
- Correct learning answers advance the first two rooms and charge a spell during the rescue.
- Read the wizard's intent and counter it with fire, shield, or healing magic. A wrong spell gives a hint without resetting the room.
- Missed or weak words are stored in browser `localStorage` and prioritized for review.
- Voice input is optional for kid/adult players and never blocks picture, spelling, or typing play.

## Learner Profiles

| Profile | Intended Player | Challenge Style |
| --- | --- | --- |
| `2y 圖像` | toddler / pre-reader | choose the matching picture; wrong answers do not cost hearts |
| `5y 單字` | early reader | tap letter tiles to assemble the English word; optional voice input is available |
| `成人/家長` | adult practice | fast typing practice; optional voice input is available |

Progress is stored in browser `localStorage`, including vocabulary, learner profile, recognition language, and per-word mastery.

## Voice Input

Voice is implemented as a safe optional input path:

- Click `說出單字`.
- Speak the English word shown by the picture.
- EchoQuest displays `聽到：...`.
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

## Roadmap

The current multi-age gameplay plan lives at:

- `docs/superpowers/plans/2026-06-29-multi-age-gameplay-upgrade.md`

Next high-impact slices:

- add a second mission after real family playtesting
- add stronger cast, shield, rescue, and treasure-opening animation
- generate distinct scene art after the Forest Rescue loop proves fun in repeated play
