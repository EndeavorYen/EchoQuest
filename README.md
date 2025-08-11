# EchoQuest

A lightweight browser game for practicing English vocabulary with voice or manual input. Designed to run on GitHub Pages (no backend required).

## Features
- Voice recognition via Web Speech API (listen per word)
- Silent mode: manual typing with space-separated spelling supported (e.g., "a p p l e")
- Vocabulary managed by image filenames and a generated `vocab.json`
- Level system: expandable architecture
  - Level 1 demo: Boss with 5 HP. Saying correct word damages boss by vocabulary level.
  - Level 2 demo: Door locked with 3 locks. Each lock corresponds to one vocabulary card.
- Supports common image formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` (via browser support)

## Project Structure
```
EchoQuest/
  index.html
  styles/
    style.css
  src/
    main.js
    vocabLoader.js
    systems/
      game.js
      levels.js
      speech.js
      views.js
    ui/
      toast.js
  pics/
    001-basic/
      apple.svg
      cat.svg
    002-animals/
      elephant.svg
    003-objects/
      umbrella.svg
  vocab.json
  scripts/
    build-vocab.js
```

## Run Locally
Two options:

1) Without a server (just open file):
   - Open `EchoQuest/index.html` directly (file://). It uses the inline demo vocab so it works without `fetch`.
   - Microphone requires a secure context (HTTPS/localhost). On file://, use Silent Mode for manual typing.

2) With a local static server (recommended for your own vocab):
   - Run any static server (e.g., VSCode Live Server, `npx serve EchoQuest`, `python -m http.server -d EchoQuest 8080`).
   - Then open: `http://localhost:PORT/`.

## Deploy to GitHub Pages
1. Commit and push this directory to your repo main branch.
2. Enable GitHub Pages → Deploy from branch → select `/ (root)` or move to `docs/` and deploy from there.
3. GitHub Pages serves over HTTPS, so microphone works where supported.

## React + TypeScript Edition (auto-deploy)
- Location: `web/` (Vite + React + TS)
- Local dev:
  ```bash
  cd web
  npm i
  npm run dev
  ```
- Build:
  ```bash
  npm run build
  ```
- Auto deploy to GitHub Pages:
  - A workflow is added at `.github/workflows/deploy-pages.yml`.
  - On every push to `main`, it builds `web/` and deploys `web/dist` to Pages.
  - Ensure GitHub Pages is configured to source from “GitHub Actions”.

## Managing Vocabulary
- Place images under `EchoQuest/pics/` with optional level subfolders: `001-basic/`, `002-animals/`, ...
- The level number is extracted from the folder prefix: `001-...` => level 1, `010-...` => level 10. Fallback is level 1.
- Generate `vocab.json` from images using the script below.
  - Recommended: square images up to ~512x512, transparent PNG or SVG for best quality. Filenames should be plain lowercase words (e.g., `ice-cream.png` becomes `ice-cream` as the word; prefer single tokens like `icecream` if you expect kids to say a single word.)

## Build vocab.json
Requires Node.js (LTS). This script scans `pics/` and outputs `vocab.json`.

Add to your repo `package.json` scripts (optional):
```json
{
  "scripts": {
    "build:vocab": "node EchoQuest/scripts/build-vocab.js"
  }
}
```

Run:
```bash
npm run build:vocab
# or
node EchoQuest/scripts/build-vocab.js
```

## Gameplay
- Click Start. The current level UI appears.
- Click Listen to capture a single spoken word. Or type the word and press Submit.
- Toggle Silent Mode to disable microphone usage.
- Fuzzy Match can be toggled to allow minor recognition variance.

## Extending Levels
Implement a factory `(ctx) => ({ start, onAnswer })` and register it via `game.registerLevel(factory)`.

Context helpers provided to your level:
- `render(node)` — render current level DOM
- `updateUi(patch)` — update HUD values (e.g., `bossHp`, `doorLocks`, `score`)
- `addScore(points)` — add to score
- `toast.show(message)` — show small notifications
- `next()` — move to next level

## Browser Support
- Speech recognition requires Chromium-based browsers with Web Speech API support.
- On iOS Safari, Web Speech API may be limited; Silent Mode is recommended.

