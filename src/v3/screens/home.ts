import { DEX, artUrl, typeOf } from '../../mon/dex';
import { partnerMon } from '../partner';
import { sfx } from '../../audio/sfx';
import type { ScreenFactory } from '../ctx';

export const home: ScreenFactory = (root, ctx) => {
  const save = ctx.save;
  const p = save.players[Math.min(save.active, save.players.length - 1)];
  const mon = partnerMon(p, save.players.indexOf(p));
  const caught = new Set(save.caught).size;
  const midTrek = !!save.run && save.run.idx > 0 && save.run.idx < save.run.nodes.length;
  sfx.setMusic('map');
  root.innerHTML = `
    <div class="app home" data-screen="home">
      <div class="hero" style="--type:${typeOf(mon).color}"><img src="${artUrl(mon.id)}" alt="${mon.name}" onerror="this.style.visibility='hidden'"></div>
      <h1>EchoQuest</h1>
      <p class="tag">念英文單字，和寶可夢一起打怪！</p>
      <div class="menu">
        <button class="btn primary" data-go="trek">${midTrek ? '繼續冒險' : '開始冒險'}</button>
        <button class="btn" data-go="dex">圖鑑<small>${caught} / ${DEX.length}</small></button>
        <button class="btn" data-go="practice">練習<small>慢慢念不打怪</small></button>
        <button class="btn" data-go="toddler">幼兒模式<small>拍照、點一點</small></button>
        <button class="btn" data-go="party">隊伍設定<small>${save.players.length} 位玩家</small></button>
      </div>
    </div>`;
};
