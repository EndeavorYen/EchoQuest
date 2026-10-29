# EchoQuest

A phone-first English spelling-the-world game in pixel art. Point the camera at
anything around you, a cute monster pops out of it, and you beat it by **saying
English words out loud**. Win fights to walk a map toward the treasure.

- **Scan once, meet a monster.** The photo becomes a 16-colour pixel backdrop and
  its colours decide the monster's colour family.
- **Cast spells with your voice.** Pick one of three spell cards (easier / on-level /
  harder — harder words hit harder), tap the mic, say the word.
- **You can't lose.** The monster telegraphs an attack; the next player says a shield
  word. Miss it and the combo resets and the monster heals a little — nobody gets hurt.
- **Take turns.** Up to 4 players share one trek, each with their own level
  (幼兒園 → 國小 → 國中 → 高中). A parent can join at 高中 for review.
- **Practice mode** never touches the map but still builds word mastery.
- Words you cast with are collected; mastery feeds which cards you are offered next.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run test:e2e # plays the whole game in a phone-sized browser (fake mic + camera)
npm run build    # static site in dist/
```

Speech recognition uses the browser's Web Speech API (Chrome / Edge / Safari over
HTTPS). Where it's unavailable or the mic is blocked, a typing box takes over.

## Notes

- Everything is drawn into a 180×(320–420) indexed framebuffer with the Sweetie 16
  palette and scaled by whole numbers; monsters, backdrops, icons and sound are all
  generated in code (no image or audio assets).
- Pixel font: [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) (OFL).
- Add `?debug` to the URL to expose the app as `window.__eq` for automated tests.
- Deploy: import the repo in Vercel (it's a plain Vite static site; `vercel.json` sets the build and allows camera/microphone). CI (`.github/workflows/ci.yml`) runs tests and a build on every PR.

## Two front ends

- `/` — the Pokémon-style app (`src/v3/`): DOM screens, colormon's colour matching (`src/mon/colorpick.ts`) and data (`src/data/mon/`, see its README for the image/IP note).
- `/classic.html` — the earlier pixel-art canvas version (`src/main.ts`, `src/scenes/`). Kept for now; same save, same word bank and speech code.

## Word bank & saves

- Words live in `src/data/packs/*.json` (one file per pack). Drop in another file and it is picked up — no code changes.
  Every pack records its `license`; only add data that is clearly free to ship.
- A word's id is `<word>:<part of speech>` (e.g. `rabbit:n`) and never changes with level or list.
- **Difficulty** (`lv`, the bands in `src/data/levels.json`) and **word lists** (`lists`, e.g. `starter`) are separate:
  one word can sit in several lists.
- Saves are versioned (`echoquest.v3`). Older saves are migrated on load and the old entry is left in place as a backup.

## Word bank

Words live in `src/data/packs/*.json`; the rules for them are in [docs/word-bank-spec.md](docs/word-bank-spec.md). Packs are append-only: words are retired, never deleted, and every change is recorded in `src/data/bankstate/` so saved progress follows the bank (`src/game/reconcile.ts`). Agent workflow: `npm run words:batches` → `words:prompt` → (Gemini) → `words:merge` → `words:commit`; `words:check` verifies everything.
