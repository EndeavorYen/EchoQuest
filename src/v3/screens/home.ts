import { DEX, artUrl, typeOf } from '../../mon/dex';
import { partnerMon } from '../partner';
import { sfx } from '../../audio/sfx';
import { esc, type ScreenFactory } from '../ctx';
import { CHANGELOG, markSeen, unseen } from '../../data/changelog';

export const home: ScreenFactory = (root, ctx) => {
  const save = ctx.save;
  const p = save.players[Math.min(save.active, save.players.length - 1)];
  const mon = partnerMon(p, save.players.indexOf(p));
  const caught = new Set(save.caught).size;
  const midTrek = !!save.townmap;
  sfx.setMusic('map');
  root.innerHTML = `
    <div class="app home" data-screen="home">
      <button class="infobtn" id="info" aria-label="更新說明"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7.8" r="1.35" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><i class="dot" id="infodot" ${unseen().length ? '' : 'hidden'}></i></button>
      <div class="hero" style="--type:${typeOf(mon).color}"><img src="${artUrl(mon.id)}" alt="${mon.name}" onerror="this.style.visibility='hidden'"></div>
      <h1>EchoQuest</h1>
      <p class="tag">念英文單字，和寶可夢一起打怪！</p>
      <div class="menu">
        <button class="btn primary" data-go="trek">${midTrek ? '繼續旅程' : '開始冒險'}</button>
        ${midTrek ? `<button class="btn" data-act="newtrip">展開新旅程<small>${esc(save.townmap!.title)}會被放棄</small></button>` : ''}
        <button class="btn" data-go="dex">圖鑑<small>${caught} / ${DEX.length}</small></button>
        <button class="btn" data-go="practice">練習<small>慢慢念不打怪</small></button>
        <button class="btn" data-go="party">隊伍設定<small>${save.players.length} 位玩家</small></button>
      </div>
    </div>`;
  root.querySelector('[data-act=newtrip]')?.addEventListener('click', () => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="card" style="text-align:center"><div class="big">展開新旅程？</div><p class="muted">現在這張地圖的進度不會保留。</p><button class="btn" data-act="yes">出發去新地方！</button><button class="btn ghost" data-act="no">先不要</button></div>`;
    m.querySelector('[data-act=no]')!.addEventListener('click', () => m.remove());
    m.querySelector('[data-act=yes]')!.addEventListener('click', () => { ctx.update((s) => ({ ...s, townmap: null })); ctx.go('trek'); });
    root.querySelector('.app')!.appendChild(m);
  });
  root.querySelector('#info')!.addEventListener('click', () => {
    const fresh = new Set(unseen().map((r) => r.version));
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="card changelog" data-screen="changelog"><div class="big">更新說明</div>
      <div class="rel-list">${CHANGELOG.map((r) => `<article class="${fresh.has(r.version) ? 'new' : ''}"><h3><b>v${esc(r.version)}</b> ${esc(r.title)} <small>${esc(r.date)}</small></h3><ul>${r.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></article>`).join('')}</div>
      <button class="btn" data-close>知道了</button></div>`;
    m.addEventListener('click', (e) => { if (e.target === m || (e.target as HTMLElement).closest('[data-close]')) m.remove(); });
    root.querySelector('.app')!.appendChild(m);
    markSeen();
    root.querySelector<HTMLElement>('#infodot')!.hidden = true;
  });
};
