import { DEX, MON_BY_ID, artUrl, spriteUrl, typeOf, type Mon } from '../../mon/dex';
import { EVO, evoTree, paginate, type EvoNode } from '../../mon/evolve';
import { partnerMon } from '../partner';
import { starsHtml, typeChip } from '../ui';
import { BACK_SVG, bar, esc, type ScreenFactory } from '../ctx';

const GENS: Array<[string, number, number]> = [
  ['關都', 1, 151], ['城都', 152, 251], ['豐緣', 252, 386], ['神奧', 387, 493], ['合眾', 494, 649],
  ['卡洛斯', 650, 721], ['阿羅拉', 722, 809], ['伽勒爾', 810, 905], ['帕底亞', 906, 1025],
];

/** 3 rows of 4: big enough to read, small enough to see a whole page at once. */
export const DEX_PAGE_SIZE = 12;

/** The Pokédex: creatures the party has beaten show up in colour, the rest as silhouettes. */
export const dex: ScreenFactory = (root, ctx) => {
  let gen = 0;
  let page = 0;
  let onlyCaught = false;
  const caught = (): Set<number> => new Set(ctx.save.caught);
  // open where the newest catch is, so a child finds the creature they just caught
  const latest = ctx.save.caught[ctx.save.caught.length - 1];
  if (latest !== undefined) {
    const g = GENS.findIndex(([, lo, hi]) => latest >= lo && latest <= hi);
    if (g >= 0) {
      gen = g;
      const idx = DEX.filter((m) => m.id >= GENS[g][1] && m.id <= GENS[g][2]).findIndex((m) => m.id === latest);
      page = Math.max(0, Math.floor(idx / DEX_PAGE_SIZE));
    }
  }

  function draw(): void {
    const have = caught();
    const [, lo, hi] = GENS[gen];
    const list = DEX.filter((m) => m.id >= lo && m.id <= hi && (!onlyCaught || have.has(m.id)));
    const pg = paginate(list, page, DEX_PAGE_SIZE);
    page = pg.page;
    const cells = pg.items
      .map((m) => {
        const got = have.has(m.id);
        return `<button class="dexcell ${got ? '' : 'unknown'}${m.id === latest ? ' latest' : ''}" data-id="${m.id}" aria-label="${got ? esc(m.name) : '還沒抓到'}"><img loading="lazy" src="${spriteUrl(m.id)}" alt="" onerror="this.style.visibility='hidden'"><span class="n">${got ? esc(m.name) : '？？？'}</span></button>`;
      })
      .join('');
    const gens = GENS.map((g, i) => {
      const n = DEX.filter((m) => m.id >= g[1] && m.id <= g[2] && have.has(m.id)).length;
      return `<button class="${i === gen ? 'on' : ''}" data-gen="${i}" title="${n} / ${g[2] - g[1] + 1}">${g[0]}</button>`;
    }).join('');
    root.innerHTML = `<div class="app" data-screen="dex">${bar(`圖鑑 ${have.size} / ${DEX.length}`)}
      <div class="seg">${gens}</div>
      <label class="onlycaught"><input type="checkbox" id="only" ${onlyCaught ? 'checked' : ''}> 只看已抓到的</label>
      <div class="scroll" id="dexarea"><div class="dexgrid">${cells || '<p class="muted dexempty">這一代還沒有抓到的寶可夢</p>'}</div></div>
      <div class="pager"><button class="icon-btn" id="prev" aria-label="上一頁" ${pg.page === 0 ? 'disabled' : ''}>${BACK_SVG}</button>
        <span id="pageinfo">第 ${pg.page + 1} 頁／共 ${pg.pages} 頁</span>
        <button class="icon-btn flip" id="next" aria-label="下一頁" ${pg.page >= pg.pages - 1 ? 'disabled' : ''}>${BACK_SVG}</button></div></div>`;
    root.querySelectorAll<HTMLElement>('[data-gen]').forEach((b) => b.addEventListener('click', () => { gen = Number(b.dataset.gen); page = 0; draw(); }));
    root.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => sheet(MON_BY_ID.get(Number(b.dataset.id))!)));
    root.querySelector('#only')!.addEventListener('change', (e) => { onlyCaught = (e.target as HTMLInputElement).checked; page = 0; draw(); });
    root.querySelector('#prev')!.addEventListener('click', () => turn(-1));
    root.querySelector('#next')!.addEventListener('click', () => turn(1));
    swipe(root.querySelector<HTMLElement>('#dexarea')!);
  }

  function turn(d: number): void {
    const before = page;
    page += d;
    const [, lo, hi] = GENS[gen];
    const have = caught();
    const total = paginate(DEX.filter((m) => m.id >= lo && m.id <= hi && (!onlyCaught || have.has(m.id))), page, DEX_PAGE_SIZE);
    if (total.page === before) { page = before; return; }
    page = total.page;
    draw();
  }

  /** swipe left for the next page, right for the one before */
  function swipe(el: HTMLElement): void {
    let x0 = 0, y0 = 0, t0 = 0, on = false;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); on = true; });
    el.addEventListener('pointercancel', () => { on = false; });
    el.addEventListener('pointerup', (e) => {
      if (!on) return;
      on = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 900) turn(dx < 0 ? 1 : -1);
    });
  }

  /** one stage of the family tree; the creature being looked at gets a box in its type colour */
  function chip(id: number, cur: number): string {
    const m = MON_BY_ID.get(id);
    if (!m) return '';
    const got = caught().has(id);
    const t = typeOf(m);
    const face = `<img src="${spriteUrl(id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" ${got ? '' : 'class="sil"'}>${got ? '' : '<i class="q">？</i>'}`;
    const label = `<b>No.${id}</b><span>${got ? esc(m.name) : '？？？'}</span>`;
    if (id === cur) return `<span class="evo-chip cur" style="--c:${t.color}"><span class="pic">${face}</span>${label}</span>`;
    return `<button class="evo-chip ${got ? '' : 'unk'}" data-evo="${id}" ${got ? '' : 'aria-label="還沒抓到"'}><span class="pic">${face}</span>${label}</button>`;
  }

  function branch(n: EvoNode, cur: number): string {
    if (!n.kids.length) return `<div class="evo-node">${chip(n.id, cur)}</div>`;
    const many = n.kids.length > 3;
    const kids = n.kids.map((k) => branch(k, cur)).join('');
    return `<div class="evo-node ${many ? 'down' : ''}">${chip(n.id, cur)}<span class="evo-arrow" aria-hidden="true">${many ? '▼' : '▶'}</span><div class="evo-kids ${many ? 'grid' : ''}">${kids}</div></div>`;
  }

  function evolution(m: Mon): string {
    const tree = evoTree(m.id, EVO);
    if (!tree) return '<div class="evo muted">沒有進化前後的型態</div>';
    return `<div class="evo"><small>進化</small><div class="evo-tree">${branch(tree, m.id)}</div></div>`;
  }

  function sheet(m: Mon): void {
    root.querySelector('.sheet')?.remove();
    const got = caught().has(m.id);
    const t = typeOf(m);
    const el = document.createElement('div');
    el.className = 'sheet';
    const seats = ctx.save.players.map((p, i) => `<button class="btn sm blue" data-seat="${i}">${esc(p.name)} 的夥伴${partnerMon(p, i).id === m.id ? ' ✓' : ''}</button>`).join('');
    el.innerHTML = `<div style="--type:${t.color}">
      <img src="${artUrl(m.id)}" alt="" style="${got ? '' : 'filter:brightness(0) opacity(.2)'}">
      <div class="big">${got ? esc(m.name) : '？？？'}</div>
      <div>${typeChip(t)} <span class="stars" aria-label="${m.rarity} 星">${starsHtml(m.rarity)}</span> <span class="muted">No.${m.id}</span></div>
      ${evolution(m)}
      ${got ? `<div class="seg">${seats}</div>` : '<div class="muted">打倒牠就能收進圖鑑</div>'}
      <button class="btn ghost" data-close>關閉</button></div>`;
    el.addEventListener('click', (e) => {
      const t2 = e.target as HTMLElement;
      if (t2 === el || t2.closest('[data-close]')) return el.remove();
      const evo = t2.closest('[data-evo]') as HTMLElement | null;
      if (evo) {
        const to = MON_BY_ID.get(Number(evo.dataset.evo));
        if (to && caught().has(to.id)) sheet(to);
        else toast('打倒牠，就能解鎖喔');
        return;
      }
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
