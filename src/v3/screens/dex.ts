import { DEX, MON_BY_ID, artUrl, spriteUrl, typeOf, type Mon } from '../../mon/dex';
import { partnerMon } from '../partner';
import { bar, esc, type ScreenFactory } from '../ctx';

const GENS: Array<[string, number, number]> = [
  ['關都', 1, 151], ['城都', 152, 251], ['豐緣', 252, 386], ['神奧', 387, 493], ['合眾', 494, 649],
  ['卡洛斯', 650, 721], ['阿羅拉', 722, 809], ['伽勒爾', 810, 905], ['帕底亞', 906, 1025],
];

/** The Pokédex: creatures the party has beaten show up in colour, the rest as silhouettes. */
export const dex: ScreenFactory = (root, ctx) => {
  let gen = 0;
  const caught = (): Set<number> => new Set(ctx.save.caught);

  function draw(): void {
    const have = caught();
    const [, lo, hi] = GENS[gen];
    const cells = DEX.filter((m) => m.id >= lo && m.id <= hi)
      .map((m) => {
        const got = have.has(m.id);
        return `<button class="dexcell ${got ? '' : 'unknown'}" data-id="${m.id}"><img loading="lazy" src="${spriteUrl(m.id)}" alt="" onerror="this.style.visibility='hidden'"><span class="n">${got ? esc(m.name) : '？？？'}</span></button>`;
      })
      .join('');
    root.innerHTML = `<div class="app" data-screen="dex">${bar(`圖鑑 ${have.size} / ${DEX.length}`)}
      <div class="seg">${GENS.map((g, i) => `<button class="${i === gen ? 'on' : ''}" data-gen="${i}">${g[0]}</button>`).join('')}</div>
      <div class="scroll"><div class="dexgrid">${cells}</div></div></div>`;
    root.querySelectorAll<HTMLElement>('[data-gen]').forEach((b) => b.addEventListener('click', () => { gen = Number(b.dataset.gen); draw(); }));
    root.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => sheet(MON_BY_ID.get(Number(b.dataset.id))!)));
  }

  function sheet(m: Mon): void {
    const got = caught().has(m.id);
    const t = typeOf(m);
    const el = document.createElement('div');
    el.className = 'sheet';
    const seats = ctx.save.players.map((p, i) => `<button class="btn sm blue" data-seat="${i}">${esc(p.name)} 的夥伴${partnerMon(p, i).id === m.id ? ' ✓' : ''}</button>`).join('');
    el.innerHTML = `<div style="--type:${t.color}">
      <img src="${artUrl(m.id)}" alt="" style="${got ? '' : 'filter:brightness(0) opacity(.2)'}">
      <div class="big">${got ? esc(m.name) : '？？？'}</div>
      <div><span class="chip" style="background:${t.color}">${t.name}</span> <span class="stars">${'★'.repeat(m.rarity)}${'☆'.repeat(5 - m.rarity)}</span> <span class="muted">No.${m.id}</span></div>
      ${got ? `<div class="seg">${seats}</div>` : '<div class="muted">打倒牠就能收進圖鑑</div>'}
      <button class="btn ghost" data-close>關閉</button></div>`;
    el.addEventListener('click', (e) => {
      const t2 = e.target as HTMLElement;
      if (t2 === el || t2.closest('[data-close]')) return el.remove();
      const seat = t2.closest('[data-seat]') as HTMLElement | null;
      if (seat) {
        const i = Number(seat.dataset.seat);
        ctx.update((s) => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, mon: m.id } : p)) }));
        el.remove();
        toast(`${ctx.save.players[i].name} 的夥伴是 ${m.name}！`);
      }
    });
    root.appendChild(el);
  }

  function toast(text: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    root.appendChild(t);
    window.setTimeout(() => t.remove(), 1800);
  }

  draw();
};
