import './battle.css';
import './theme.css';
import { load, persist, type Save } from '../game/save';
import { Recognizer } from '../speech/recognizer';
import { sfx } from '../audio/sfx';
import { Rng } from '../util/rng';
import type { Ctx, Screen, ScreenFactory, ScreenName } from './ctx';
import { home } from './screens/home';
import { trek } from './screens/trek';
import { scan } from './screens/scan';
import { battle } from './screens/battle';
import { dex } from './screens/dex';
import { party } from './screens/party';
import { practice } from './screens/practice';
import { toddler } from './screens/toddler';

const SCREENS: Record<ScreenName, ScreenFactory> = { home, trek, scan, battle, dex, party, practice, toddler };

const root = document.getElementById('app') as HTMLElement;
const query = new URLSearchParams(location.search);

let current: Screen | void = undefined;
let save: Save = load();
sfx.enabled = save.sound;
sfx.musicOn = save.music;

const ctx: Ctx = {
  get save() { return save; },
  rec: new Recognizer(),
  rng: new Rng(Date.now()),
  update(fn) {
    save = fn(save);
    persist(save);
  },
  go(name, params) {
    current?.destroy?.();
    root.innerHTML = '';
    root.scrollTop = 0;
    current = SCREENS[name](root, ctx, params);
  },
};

// one tap anywhere unlocks audio (browsers need a gesture); data-go buttons navigate
root.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-go]') as HTMLElement | null;
  if (t) {
    sfx.play('tap');
    ctx.go(t.dataset.go as ScreenName);
  }
});

if (query.has('debug')) Object.assign(window, { __app: ctx });
const start = query.get('screen') as ScreenName | null;
ctx.go(start && start in SCREENS ? start : 'home');
