# EchoQuest

EchoQuest is a local-first English learning adventure game for a family audience: toddlers, young kids, and adults share the same vocabulary and quest content while playing through different challenge modes.

## Current Game Loop

- Pick a learner profile on the main menu.
- Practice vocabulary through boss and puzzle encounters.
- Correct answers damage bosses, collect puzzle tools, build combo, and update learning progress.
- Missed or weak words are prioritized for review.

## Learner Profiles

| Profile | Intended Player | Challenge Style |
| --- | --- | --- |
| `2y 圖像` | toddler / pre-reader | choose the matching picture; mastered words can upgrade from 2 choices to 3 choices |
| `5y 單字` | early reader | see the picture, use first-letter guidance, then type the word |
| `Adult` | adult practice | free typing or voice practice without forced hints |

Progress is stored in browser `localStorage`, including vocabulary, learner profile, recognition language, and per-word mastery.

## Development

```powershell
cd web
npm install
npm test -- --runInBand
npm run build
npm start
```

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

- connect encounter intents to actual battle mechanics
- turn the level panel into a richer scene stage
- generate Codex image2 biome backgrounds and boss state art after rules stabilize
