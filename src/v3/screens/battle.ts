import { nextRelic } from '../../game/run';
import { retreat, winEntering } from '../../game/townmap';
import { sfx } from '../../audio/sfx';
import { battleTrack } from '../../audio/songs';
import { BattleView } from '../battle-view';
import { BattleController } from '../battle-controller';
import { pickWild, TYPES } from '../../mon/dex';
import type { BattleParams, ScreenFactory } from '../ctx';

/** One fight: a wild creature (or a co-op boss) against the party's partners. */
export const battle: ScreenFactory = (root, ctx, params: BattleParams) => {
  const view = new BattleView(root);
  // the controller keeps its own copy of the save; it only ever writes back what it owns, so a late
  // write can never undo the map (or anything else the screen changed meanwhile)
  const ctl = new BattleController(view, ctx.save, ctx.rec, (s) =>
    ctx.update((cur) => ({ ...cur, players: s.players, growth: s.growth, aliases: s.aliases, caught: [...new Set([...cur.caught, ...s.caught])] })),
  );
  const boss = !!params.boss;
  sfx.setMusic(battleTrack(boss, !!params.final));
  let finished = false;

  ctl.onWin = (foe) => {
    const isNew = !ctx.save.caught.includes(foe.id);
    ctx.update((s) => {
      const relic = boss ? nextRelic(s.relics, s.treks * 7 + 5) : null;
      const next = {
        ...s,
        caught: isNew ? [...s.caught, foe.id] : s.caught,
        relics: relic && !s.relics.includes(relic.id) ? [...s.relics, relic.id] : s.relics,
      };
      if (params.trek && s.townmap) {
        // the win is kept on the map; beating the league ends this region
        const m = s.townmap;
        if (m.entering !== null && m.nodes[m.entering].kind === 'league') {
          finished = true;
          const journey = { title: m.title, size: m.size, date: new Date().toISOString().slice(0, 10) };
          return { ...next, townmap: null, treks: s.treks + 1, journeys: [...s.journeys, journey].slice(-50) };
        }
        return { ...next, townmap: winEntering(m) };
      }
      return next;
    });
    return { isNew, nextLabel: params.trek ? (finished ? '完成冒險！' : '繼續冒險') : '再遇見一隻' };
  };
  ctl.onNextFoe = () => {
    if (params.trek) ctx.go(finished ? 'home' : 'trek');
    else ctl.start(pickWild(ctx.rng, { maxRarity: 3, owned: new Set(ctx.save.caught) }));
  };
  // running away or losing changes nothing: the party goes back to the place it set out from
  const back = (): void => {
    if (params.trek) ctx.update((s) => (s.townmap ? { ...s, townmap: retreat(s.townmap) } : s));
    ctx.go(params.trek ? 'trek' : 'home');
  };
  ctl.onLeave = back;
  ctl.onLose = back;
  ctl.start(params.foe, boss, Math.min(ctx.save.active, ctx.save.players.length - 1));
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __v3: Object.assign(ctl, { view }), __types: TYPES });
  return { destroy: () => ctl.dispose() };
};
