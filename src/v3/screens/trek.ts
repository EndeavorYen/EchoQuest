import { advance, currentNode, isFinished, nextRelic, type NodeType } from '../../game/run';
import { startRun } from '../../game/save';
import { sfx } from '../../audio/sfx';
import { bar, esc, type ScreenFactory } from '../ctx';

const ICON: Record<NodeType, string> = { monster: '🐾', chest: '🎁', boss: '👑' };
const THEME: Record<string, string> = { meadow: '草原', night: '夜晚', cave: '洞窟', sunset: '夕陽' };
const LABEL: Record<NodeType, string> = { monster: '野生寶可夢', chest: '寶箱', boss: '首領' };

/** The six-stop trek: wild creatures, a chest, and a co-op boss at the end. */
export const trek: ScreenFactory = (root, ctx) => {
  if (!ctx.save.run || isFinished(ctx.save.run)) ctx.update((s) => startRun(s));
  const run = ctx.save.run!;
  const node = currentNode(run)!;
  sfx.setMusic('map');

  const list = run.nodes
    .map((n, i) => `<div class="node ${i < run.idx ? 'done' : ''} ${i === run.idx ? 'now' : ''} ${n.type === 'boss' ? 'boss' : ''}">
        <span class="ico">${i < run.idx ? '✅' : ICON[n.type]}</span>
        <span class="grow">第 ${i + 1} 站 · ${LABEL[n.type]}</span><span class="muted">${THEME[n.theme] ?? ''}</span></div>`)
    .join('');

  const cta = node.type === 'chest' ? '打開寶箱' : node.type === 'boss' ? '挑戰首領！' : '拍照找寶可夢';
  root.innerHTML = `<div class="app" data-screen="trek">${bar('冒險')}
    <div class="screen scroll"><div class="nodes">${list}</div></div>
    <button class="btn" id="go">${cta}</button></div>`;

  root.querySelector('#go')!.addEventListener('click', () => {
    if (node.type === 'chest') return openChest();
    ctx.go('scan', { kind: 'trek', boss: node.type === 'boss' });
  });

  function openChest(): void {
    const relic = nextRelic(ctx.save.relics, ctx.save.treks * 7 + run.idx);
    sfx.play('chest');
    ctx.update((s) => ({ ...s, relics: s.relics.includes(relic.id) ? s.relics : [...s.relics, relic.id], run: advance(s.run!) }));
    root.innerHTML = `<div class="app" data-screen="chest">${bar('寶箱', null)}
      <div class="screen" style="justify-content:center;align-items:center;text-align:center">
        <div class="relic">${relic.icon}</div><div class="big">${esc(relic.zh)}</div><div class="muted">${esc(relic.name)}</div></div>
      <button class="btn" data-go="trek">繼續冒險</button></div>`;
  }
};
