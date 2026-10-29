import { advance, isFinished, nextRelic } from '../../game/run';
import { sfx } from '../../audio/sfx';
import { BattleView } from '../battle-view';
import { BattleController } from '../battle-controller';
import { pickWild } from '../../mon/dex';
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
      if (params.trek && s.run) {
        const run = advance(s.run);
        return isFinished(run) ? { ...next, run: null, treks: s.treks + 1 } : { ...next, run };
      }
      return next;
    });
    return { isNew, nextLabel: params.trek ? (boss ? '完成冒險！' : '繼續冒險') : '再遇見一隻' };
  };
  ctl.onNextFoe = () => {
    if (params.trek) ctx.go(boss ? 'home' : 'trek');
    else ctl.start(pickWild(ctx.rng, { maxRarity: 3, owned: new Set(ctx.save.caught) }));
  };
  ctl.onLeave = () => ctx.go(params.trek ? 'trek' : 'home');
  ctl.start(params.foe, boss, Math.min(ctx.save.active, ctx.save.players.length - 1));
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __v3: ctl });
  return { destroy: () => ctl.dispose() };
};
