import { MAX_PLAYERS, newPlayer, PLAYER_NAMES, type Level } from '../../game/model';
import { svg } from '../icons';
import { levelStat } from '../../game/progress';
import { LEVELS, PACKS, WORDS } from '../../data/words';
import { MON_BY_ID, STARTER_IDS, artUrl, typeOf } from '../../mon/dex';
import { buildExport, commitExport, pendingCount, readLog, type ExportScope } from '../../speech/heardlog';
import { CHANGELOG } from '../../data/changelog';
import { sfx } from '../../audio/sfx';
import { haptics } from '../../audio/haptics';
import { partnerMon } from '../partner';
import { evolvesTo, growthOf, isReady, xpNeeded } from '../../mon/growth';
import { roundPrefs, type RoundPrefs } from '../rounds';
import { bar, esc, type ScreenFactory } from '../ctx';

/** One line per shipped word source that asks for credit. */
function credits(): string {
  const lines = PACKS.filter((p) => p.id !== 'starter').map((p) => (p.id === 'cefrj' ? `${p.name}（Tono Laboratory, TUFS）` : p.name));
  return (lines.length ? lines : ['自編入門字']).map((l) => `<span class="muted">${esc(l)}</span>`).join('');
}

const ROUND_NAMES: Array<[keyof RoundPrefs, string]> = [['listen', '聽音選圖'], ['spell', '拼字'], ['memory', '翻牌配對']];

/** Party setup: who plays, at which level, with which partner; plus sound and the heard-words log. */
export const party: ScreenFactory = (root, ctx) => {
  function growLine(id: number): string {
    const g = growthOf(ctx.save.growth, id);
    const need = xpNeeded(g);
    const what = evolvesTo(id).length ? '進化' : '升星';
    const text = need === null ? '已經最強了' : isReady(g) ? `打贏下一場就${what}！` : `再 ${need - g.xp} 經驗就${what}`;
    const frac = need === null ? 1 : g.xp / need;
    return `<div class="xpline ${need === null ? 'max' : isReady(g) ? 'ready' : ''}" data-grow="${id}"><span class="rank">${'★'.repeat(g.rank)}</span><div class="xp"><i style="width:${Math.round(frac * 100)}%"></i></div></div>
            <div class="muted small">${text}</div>`;
  }

  function draw(): void {
    const { players, sound, music } = ctx.save;
    const buzz = ctx.save.haptics !== false;
    const rounds = roundPrefs(ctx.save.rounds);
    const cards = players
      .map((p, i) => {
        const m = partnerMon(p, i);
        const st = levelStat(p.progress, WORDS, p.level);
        const info = LEVELS[p.level - 1];
        return `<div class="card pcard" style="--type:${typeOf(m).color}">
          <button class="av" data-pick="${i}" aria-label="換夥伴"><img src="${artUrl(m.id)}" alt="" onerror="this.style.visibility='hidden'"></button>
          <div class="grow">
            <div class="nm"><input class="nameinput" data-name="${i}" value="${esc(p.name)}" maxlength="8" aria-label="名字" autocomplete="off" spellcheck="false"> <span class="muted">· ${esc(m.name)}</span></div>
            ${growLine(m.id)}
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
        <div class="card stack" id="rounds"><div><b>題型</b><br><span class="muted">念單字之外，偶爾換個玩法（太難可以關掉）</span></div>
          <div class="row wrap">${ROUND_NAMES.map(([k, zh]) => `<button class="btn sm ${rounds[k] ? 'good' : 'ghost'}" data-round="${k}">${zh}${rounds[k] ? '：開' : '：關'}</button>`).join('')}</div></div>
        <div class="card stack"><div class="row"><span class="grow"><b>音效</b></span><button class="btn sm ${sound ? 'good' : 'ghost'}" id="snd">${sound ? '開' : '關'}</button></div>
          <div class="row"><span class="grow"><b>音樂</b></span><button class="btn sm ${music ? 'good' : 'ghost'}" id="mus">${music ? '開' : '關'}</button></div>
          ${haptics.supported ? `<div class="row"><span class="grow"><b>震動</b><br><span class="muted">收服時手機會震動</span></span><button class="btn sm ${buzz ? 'good' : 'ghost'}" id="buzz">${buzz ? '開' : '關'}</button></div>` : ''}
          <div class="row"><span class="grow"><b>辨識紀錄</b><br><span class="muted">語音聽不準時，複製給開發者調整（複製後紀錄仍保留在手機裡）</span></span></div>
          <div class="row"><button class="btn sm good grow" id="logNew">複製新的（${pendingCount()}）</button><button class="btn sm ghost grow" id="logAll">複製全部（${readLog().length}）</button></div>
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
    root.querySelectorAll<HTMLElement>('[data-round]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.round as keyof RoundPrefs;
      ctx.update((s) => ({ ...s, rounds: { ...roundPrefs(s.rounds), [k]: !roundPrefs(s.rounds)[k] } }));
      sfx.play('select');
      draw();
    }));
    root.querySelector('#buzz')?.addEventListener('click', () => { ctx.update((s) => ({ ...s, haptics: s.haptics === false })); haptics.enabled = ctx.save.haptics !== false; haptics.pulse(30); draw(); });
    root.querySelector('#mus')!.addEventListener('click', () => { ctx.update((s) => ({ ...s, music: !s.music })); sfx.musicOn = ctx.save.music; draw(); });
    const copyLog = async (scope: ExportScope): Promise<void> => {
      const msg = root.querySelector('#logmsg') as HTMLElement;
      const out = buildExport(scope, CHANGELOG[0].version);
      try {
        await navigator.clipboard.writeText(out.text);
        commitExport(out);
        msg.textContent = `已複製 ${out.count} 筆（第 ${out.number} 次匯出，${out.id}）`;
        const nb = root.querySelector('#logNew');
        if (nb) nb.textContent = `複製新的（${pendingCount()}）`;
      } catch {
        msg.textContent = '無法複製';
      }
    };
    root.querySelector('#logNew')!.addEventListener('click', () => void copyLog('new'));
    root.querySelector('#logAll')!.addEventListener('click', () => void copyLog('all'));
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
