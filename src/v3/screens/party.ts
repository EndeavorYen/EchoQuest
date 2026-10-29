import { MAX_PLAYERS, newPlayer, PLAYER_NAMES, type Level } from '../../game/model';
import { svg } from '../icons';
import { levelStat } from '../../game/progress';
import { LEVELS, PACKS, WORDS } from '../../data/words';
import { MON_BY_ID, STARTER_IDS, artUrl, typeOf } from '../../mon/dex';
import { exportLog } from '../../speech/heardlog';
import { sfx } from '../../audio/sfx';
import { partnerMon } from '../partner';
import { bar, esc, type ScreenFactory } from '../ctx';

/** One line per shipped word source that asks for credit. */
function credits(): string {
  const lines = PACKS.filter((p) => p.id !== 'starter').map((p) => (p.id === 'cefrj' ? `${p.name}（Tono Laboratory, TUFS）` : p.name));
  return (lines.length ? lines : ['自編入門字']).map((l) => `<span class="muted">${esc(l)}</span>`).join('');
}

/** Party setup: who plays, at which level, with which partner; plus sound and the heard-words log. */
export const party: ScreenFactory = (root, ctx) => {
  function draw(): void {
    const { players, sound, music } = ctx.save;
    const cards = players
      .map((p, i) => {
        const m = partnerMon(p, i);
        const st = levelStat(p.progress, WORDS, p.level);
        const info = LEVELS[p.level - 1];
        return `<div class="card pcard" style="--type:${typeOf(m).color}">
          <button class="av" data-pick="${i}" aria-label="換夥伴"><img src="${artUrl(m.id)}" alt="" onerror="this.style.visibility='hidden'"></button>
          <div class="grow">
            <div class="nm"><input class="nameinput" data-name="${i}" value="${esc(p.name)}" maxlength="8" aria-label="名字" autocomplete="off" spellcheck="false"> <span class="muted">· ${esc(m.name)}</span></div>
            <div class="stepper"><button data-lv="${i}" data-d="-1" ${p.level <= 1 ? 'disabled' : ''} aria-label="簡單一點">−</button>
              <b>Lv.${p.level} ${esc(info.name)}</b>
              <button data-lv="${i}" data-d="1" ${p.level >= 4 ? 'disabled' : ''} aria-label="難一點">＋</button></div>
            <div class="muted">學會 ${st.learned} / ${st.total} 個單字</div>
            <label class="row muted"><input type="checkbox" data-adult="${i}" ${p.adult ? 'checked' : ''}> 我是大人（首領的護盾會彈開大人的咒語）</label></div>
          ${players.length > 1 ? `<button class="icon-btn" data-del="${i}" aria-label="移除">${svg('close')}</button>` : ''}</div>`;
      })
      .join('');
    root.innerHTML = `<div class="app" data-screen="party">${bar('隊伍設定')}
      <div class="scroll"><div class="stack">${cards}
        ${players.length < MAX_PLAYERS ? '<button class="btn ghost" id="add">＋ 加入玩家</button>' : ''}
        <div class="card stack"><div class="row"><span class="grow"><b>音效</b></span><button class="btn sm ${sound ? 'good' : 'ghost'}" id="snd">${sound ? '開' : '關'}</button></div>
          <div class="row"><span class="grow"><b>音樂</b></span><button class="btn sm ${music ? 'good' : 'ghost'}" id="mus">${music ? '開' : '關'}</button></div>
          <div class="row"><span class="grow"><b>辨識紀錄</b><br><span class="muted">複製給開發者調整語音辨識</span></span><button class="btn sm ghost" id="log">複製</button></div>
          <div class="muted" id="logmsg"></div></div>
        <div class="card stack"><b>字庫來源</b>${credits()}</div></div></div></div>`;
    root.querySelectorAll<HTMLElement>('[data-lv]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.lv), d = Number(b.dataset.d);
      ctx.update((s) => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, level: Math.max(1, Math.min(4, p.level + d)) as Level } : p)) }));
      sfx.play('select');
      draw();
    }));
    root.querySelectorAll<HTMLInputElement>('[data-name]').forEach((inp) => {
      const i = Number(inp.dataset.name);
      inp.addEventListener('input', () => {
        const name = inp.value.trim().slice(0, 8);
        if (name) ctx.update((s) => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, name } : p)) }));
      });
      inp.addEventListener('blur', () => { if (!inp.value.trim()) inp.value = ctx.save.players[i].name; });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    });
    root.querySelectorAll<HTMLInputElement>('[data-adult]').forEach((b) => b.addEventListener('change', () => {
      const i = Number(b.dataset.adult);
      ctx.update((s) => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, adult: b.checked } : p)) }));
    }));
    root.querySelectorAll<HTMLElement>('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.del);
      ctx.update((s) => ({ ...s, players: s.players.filter((_, k) => k !== i), active: 0 }));
      draw();
    }));
    root.querySelector('#add')?.addEventListener('click', () => {
      ctx.update((s) => ({ ...s, players: [...s.players, { ...newPlayer(s.players.length, 1), name: PLAYER_NAMES[s.players.length % PLAYER_NAMES.length] }] }));
      draw();
    });
    root.querySelector('#snd')!.addEventListener('click', () => { ctx.update((s) => ({ ...s, sound: !s.sound })); sfx.enabled = ctx.save.sound; draw(); });
    root.querySelector('#mus')!.addEventListener('click', () => { ctx.update((s) => ({ ...s, music: !s.music })); sfx.musicOn = ctx.save.music; draw(); });
    root.querySelector('#log')!.addEventListener('click', async () => {
      const text = exportLog();
      const n = text ? text.trim().split('\n').length : 0;
      try { await navigator.clipboard.writeText(text); (root.querySelector('#logmsg') as HTMLElement).textContent = `已複製 ${n} 筆`; } catch { (root.querySelector('#logmsg') as HTMLElement).textContent = '無法複製'; }
    });
    root.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.pick))));
  }

  function pick(i: number): void {
    const ids = [...new Set([...STARTER_IDS, ...ctx.save.caught])];
    const el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = `<div><div class="big">選夥伴</div><div class="choices">${ids
      .map((id) => `<button data-mon="${id}" aria-label="${esc(MON_BY_ID.get(id)?.name ?? '')}"><img src="${artUrl(id)}" alt="" onerror="this.style.visibility='hidden'"></button>`)
      .join('')}</div><div class="muted">打倒的寶可夢都能當夥伴</div><button class="btn ghost" data-close>關閉</button></div>`;
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el || t.closest('[data-close]')) return el.remove();
      const b = t.closest('[data-mon]') as HTMLElement | null;
      if (b) {
        ctx.update((s) => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, mon: Number(b.dataset.mon) } : p)) }));
        el.remove();
        draw();
      }
    });
    root.appendChild(el);
  }

  draw();
};
