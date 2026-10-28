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
npm test
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
- Deployed by `.github/workflows/deploy.yml` (GitHub Pages, source: GitHub Actions).
