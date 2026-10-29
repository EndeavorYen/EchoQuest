import './battle.css';
import { load, persist, type Save } from '../game/save';
import { Recognizer } from '../speech/recognizer';
import { DEX, MON_BY_ID, pickWild } from '../mon/dex';
import { Rng } from '../util/rng';
import { BattleView } from './battle-view';
import { BattleController } from './battle-controller';

const root = document.getElementById('app') as HTMLElement;
const view = new BattleView(root);
let save: Save = load();
const ctl = new BattleController(view, save, new Recognizer(), (s) => {
  save = s;
  persist(s);
});

const rng = new Rng(Date.now());
const q = new URLSearchParams(location.search);
const pick = () => {
  const forced = Number(q.get('mon'));
  return forced && MON_BY_ID.get(forced) ? MON_BY_ID.get(forced)! : pickWild(rng, { maxRarity: 3 });
};
ctl.nextFoe = pick;
ctl.start(pick());
if (q.has('debug')) Object.assign(window, { __v3: ctl, __dex: DEX });
