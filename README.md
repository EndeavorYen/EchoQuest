# EchoQuest

A phone-first English-practice game. Walk a Pokémon-style town map, meet the
monsters that live in each place, and beat them by **saying English words out
loud**. Win fights to reach the league at the end of the map.

- **Walk the map, meet a monster.** Each place on the Town Map decides which kind of monster lives there.
- **Cast spells with your voice.** Pick one of three spell cards (easier / on-level /
  harder — harder words hit harder), tap the mic, say the word.
- **Nobody really loses.** The monster telegraphs an attack; the next player says a shield
  word. Miss it and the party loses a heart; with no hearts left the fight ends and the party
  simply goes back to the place it came from.
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
  - **Town Map** (`src/game/townmap.ts`, drawn by `src/v3/screens/trek.ts`): a map in the spirit of the handheld Pokémon Town Maps — a grid of square cells, places joined by named roads (1號道路, 2號水路…) that only run north, south, east and west. Big places are towns, gym cities (wide blocks), caves, forests, islands, special buildings (power plant, old tower…) and, at the top, the league. Each road has 1–2 small stops; every stop and every big place but a town holds one wild creature (a gym city and the league hold a boss) and, once beaten, it stays beaten. Tap a place and the party goes there at once (no confirm step; backing out of the meeting is free) and the creature of that place appears — there is no camera on the trek. Places next door to somewhere the party has stood glow with an arrow (`frontier`); a new place can only be entered from a place next to it, so the party first walks there through places it has already been to; a place already visited can be tapped from anywhere, however far (`planTrip`, `walkPath`).
    - Every map is generated from a seed and is different: small / medium / large (35 / 45 / 20 %), 0–3 gym cities (the shortest way through is about 6 / 10 / 14 fights), forks and optional side roads. Rules (`checkTownMap`, tested on hundreds of seeds): everything reachable, one start and one league, gym cities are bottlenecks, roads never share a cell and never turn diagonally, 1–2 stops per road, at least one town and one gift.
    - Who turns up: each place has types (`src/mon/habitat.ts` terrain pools, special buildings have their own, drawn from a shuffled bag so every type shows up over time) and a rarity table (small stops mostly ★1–2 with ~1 % ★4+, big places ★2–5, gym bosses ★3–4, the final boss ★4–5; rarer further up the map). Creatures already caught turn up less often.
    - Unexplored places are under soft clouds (`visibleNodes` / `clearCells`): what you have visited, the neighbours of where you stand and the league at the top are in view; the rest lifts as you walk. The map opens on the party, zoomed in (about 1.6×) and is never shrunk to fit: pinch, the ＋／－ buttons or ctrl + wheel zoom (1×–2.5×), a finger drags, 🎯 returns to the party.
    - Towns are safe: ☁️ clearing the clouds (shows the places and types within 5 steps), 💬 the villager's quiz (three spoken words, a present for two right) and 🎁 a first-visit present.
    - The party shares 5 hearts per fight (7 against a boss). Losing all of them, running away or backing out puts the party back on the place it came from; nothing else changes. Beating the league ends the map; only the map in progress is stored on the phone (a one-line log of finished regions is kept), and 展開新旅程 on the home screen starts a new one.
    - Toddler mode (camera and tap) is still in the code (`/` screen `toddler`) but is not offered on the home screen for now.
  - **Sound** (`src/audio/sfx.ts`, tunes in `src/audio/songs.ts`): everything is synthesised (square / triangle / noise, no audio files) and the tunes are original. Spells sound by move style (flame, bubble, bolt, ice…); dodge, reflect, shield crack / shatter, status, boss entrance (the champion's is bigger), win and lose each have their own. Seven tunes: home / towns, two outdoor tunes that alternate, a cave tune, an ordinary battle, a gym leader (tenser) and the champion (fastest). Music is kept well under the effects; music and effects have separate switches on the title screen of the classic front end and `sfx.enabled` / `sfx.musicOn`.
  - **Dex** (`src/v3/screens/dex.ts`): 12 a page (3×4) within the chosen generation, arrows or a swipe to turn the page, a "caught only" box, and an evolution family tree on the sheet (`src/mon/evolve.ts`, data `src/data/mon/evolutions.json`): the creature you opened is boxed in its type colour, relatives you have not caught are silhouettes with a question mark.
  - **Speech never traps a round** (`src/v3/battle-controller.ts`): a "heard nothing" result counts as an attempt just like a wrong word. Defending, `RESCUE_AFTER` (2) unheard attempts raise a plain block (no reflect / counter bonus, logged as `rescued`) instead of letting the creature hit; attacking, after `STUCK_AFTER` (3) the panel shows big 我念對了 (learns the heard spelling, logged `confirmed`) and 跳過這個字 (a fizzle, logged `skipped`) buttons. Everything lands in the on-device log (`src/speech/heardlog.ts`); Party settings copies it as 複製新的 / 複製全部 with a stamped header (export number, unique ID, scope, count, version). Exporting never deletes records. Handled exports are recorded in [`docs/recog-reports.md`](docs/recog-reports.md): when a report is pasted, check its ID there first, skip it if listed, otherwise fix the alias table and add a row (and put the ID in the commit message).
  - **Rare and legendary creatures** (`src/mon/rarity.ts`): 4★ = rare, 5★ = legend, wherever they are met (a cave or road as well as a gym). They always carry a shield (rare 2 layers, legend 3; gym leaders keep 2, or 3 from 4★), the party gets 6 hearts, and they arrive with a banner, flash and chime (legend: rumble too). Look: a pulsing halo (rare) or a spinning gold ring with sparkles and a bigger body (legend), a tinted name plate, and a dressed-up reveal screen. Their own move is thrown at power 2 (a legend throws it twice) and shakes the arena; the wind-up warning is louder (`warn` takes 0/1/2).
  - **The catch** (`src/v3/capture.ts`, `BattleView.capture`): a win is not a fade-out any more. The creature shrinks into a ball (red; blue for 4★, gold for 5★) that drops, wobbles three times and locks with a star burst and "新收服！" for a first catch; the victory panel follows at 2.7 s. One beat table drives the picture, the sounds (`catchSuck` / `catchWobble` / `catchLock`) and the phone's vibration (`src/audio/haptics.ts`, `navigator.vibrate`, silently ignored where missing such as iOS). Party settings has a 震動 switch (`save.haptics`, absent = on) that only shows where vibration exists.
  - **What's new**: the ⓘ on the home screen opens `src/data/changelog.ts` (player-facing, a few plain lines per version, newest first; a red dot shows until it has been read). Add an entry there for each release; implementation detail belongs here in the README instead.
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
