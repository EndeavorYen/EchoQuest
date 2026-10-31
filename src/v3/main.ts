import './battle.css';
import './theme.css';
import { load, persist, type Save } from '../game/save';
import { haptics } from '../audio/haptics';
import { forceRound } from './rounds';
import { holdTaps, installTapGuard } from './taps';
import { markSeen } from '../data/changelog';
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
// tests (and anyone curious) can pin the kind of attack round: ?debug&rounds=listen
{
  const r = query.has('debug') ? query.get('rounds') : null;
  if (r === 'speak' || r === 'listen' || r === 'spell' || r === 'memory') forceRound(r);
}

let current: Screen | void = undefined;
let currentName: ScreenName = 'home';
let currentParams: unknown = undefined;
// a brand-new family has nothing "new" to read about: the ⓘ dot is for changes after they started
const firstRun = (() => { try { return !localStorage.getItem('echoquest.v3') && !localStorage.getItem('echoquest.v2'); } catch { return false; } })();
let save: Save = load();
if (firstRun) markSeen();
sfx.enabled = save.sound;
sfx.musicOn = save.music;
haptics.enabled = save.haptics !== false;

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
    currentName = name;
    currentParams = params;
    trackHistory(name);
    holdTaps();
    current = SCREENS[name](root, ctx, params);
  },
};

// ---- the phone's back button --------------------------------------------------------------
// Two history entries at most: home, and "somewhere inside". Back from inside does what the screen's
// own back button does (in a fight that is 逃走, which asks first); back from home leaves the app.
let inside = false;
let ignorePop = false;
function trackHistory(name: ScreenName): void {
  try {
    if (name === 'home') {
      if (inside) { ignorePop = true; inside = false; history.back(); }
    } else if (!inside) {
      history.pushState({ eq: 'in' }, '');
      inside = true;
    }
  } catch {
    // history can be unavailable in odd embeds; the in-app buttons still work
  }
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  inside = false;
  const back = root.querySelector<HTMLElement>('.bar [data-go], .bar [data-act=leave]');
  if (back) back.click();
  else if (currentName !== 'home') ctx.go('home');
  // still inside (a "really leave?" question is open): stay in the app
  if (currentName !== 'home' && !inside) {
    try { history.pushState({ eq: 'in' }, ''); inside = true; } catch { /* ignore */ }
  }
});

// ---- another tab changed the save: pick it up so neither tab undoes the other ---------------
window.addEventListener('storage', (e) => {
  if (e.key !== null && !e.key.startsWith('echoquest.v3')) return;
  save = load();
  sfx.enabled = save.sound;
  sfx.musicOn = save.music;
  haptics.enabled = save.haptics !== false;
  // a fight keeps its own copy and only writes what it owns; other screens simply redraw
  if (currentName !== 'battle' && currentName !== 'scan' && currentName !== 'practice') ctx.go(currentName, currentParams);
});

// ---- in the background: no music, and the shield clock does not run (see BattleController.tick)
document.addEventListener('visibilitychange', () => sfx.pause(document.hidden));

// one tap anywhere unlocks audio (browsers need a gesture); data-go buttons navigate
installTapGuard(root);
root.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-go]') as HTMLElement | null;
  if (t) {
    sfx.play('tap');
    ctx.go(t.dataset.go as ScreenName);
  }
});

if (query.has('debug')) Object.assign(window, { __app: ctx });
// ?screen= is for development only, and only for screens that need nothing passed in
const start = query.has('debug') ? (query.get('screen') as ScreenName | null) : null;
ctx.go(start && ['home', 'trek', 'dex', 'party', 'practice'].includes(start) ? start : 'home');
