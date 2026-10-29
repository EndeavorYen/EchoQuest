import { nextRelic } from '../../game/run';
import { arrive, stay } from '../../game/trail';
import { sfx } from '../../audio/sfx';
import { BattleView } from '../battle-view';
import { BattleController } from '../battle-controller';
import { pickWild, TYPES } from '../../mon/dex';
import type { BattleParams, ScreenFactory } from '../ctx';

/** One fight: a wild creature (or a co-op boss) against the party's partners. */
export const battle: ScreenFactory = (root, ctx, params: BattleParams) => {
  const view = new BattleView(root);
  const ctl = new BattleController(view, ctx.save, ctx.rec, (s) => ctx.update(() => s));
  sfx.setMusic('battle');
  const boss = !!params.boss;

  ctl.onWin = (foe) => {
    const isNew = !ctx.save.caught.includes(foe.id);
    ctx.update((s) => {
      const relic = boss ? nextRelic(s.relics, s.treks * 7 + 5) : null;
      const next = {
        ...s,
        caught: isNew ? [...s.caught, foe.id] : s.caught,
        relics: relic && !s.relics.includes(relic.id) ? [...s.relics, relic.id] : s.relics,
      };
      if (params.trek && s.trail) {
        // the party walks on to the stop it just cleared; a beaten boss ends the map
        if (boss) return { ...next, trail: null, treks: s.treks + 1 };
        return { ...next, trail: s.trail.target === null ? s.trail : arrive(s.trail, s.trail.target) };
      }
      return next;
    });
    return { isNew, nextLabel: params.trek ? (boss ? '完成冒險！' : '繼續冒險') : '再遇見一隻' };
  };
  ctl.onNextFoe = () => {
    if (params.trek) ctx.go(boss ? 'home' : 'trek');
    else ctl.start(pickWild(ctx.rng, { maxRarity: 3, owned: new Set(ctx.save.caught) }));
  };
  // running away or losing changes nothing: the party stays on the stop it came from
  const back = (): void => {
    if (params.trek) ctx.update((s) => (s.trail ? { ...s, trail: stay(s.trail) } : s));
    ctx.go(params.trek ? 'trek' : 'home');
  };
  ctl.onLeave = back;
  ctl.onLose = back;
  ctl.start(params.foe, boss, Math.min(ctx.save.active, ctx.save.players.length - 1));
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __v3: Object.assign(ctl, { view }), __types: TYPES });
  return { destroy: () => ctl.dispose() };
};
