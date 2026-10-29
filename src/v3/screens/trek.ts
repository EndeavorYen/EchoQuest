import {
  atTown, CELL, clearCells, COLS, visibleNodes, canGift, canInfo, canQuiz, catOf, generateTownMap, isBig, isRevealed, kindLabel, moveTo, needsFight, neighbors, progressOf, rememberFoe,
  retreat, rollRarity, roadIcon, SIZE_NAME, startEntering, takeGift, useInfo, type MapNode, type RoadKind, type TownMap,
} from '../../game/townmap';
import { nextRelic } from '../../game/run';
import { artUrl, DEX, pickEncounter, TYPES } from '../../mon/dex';
import type { Habitat } from '../../mon/habitat';
import { partnerMon } from '../partner';
import { sfx } from '../../audio/sfx';
import { bar, esc, type ScanParams, type ScreenFactory } from '../ctx';

/** the zoom the player last used on the map: 1 = the map fills the width, and it stays that way between visits */
let lastZoom = 1.6;
const MIN_ZOOM = 1, MAX_ZOOM = 2.5;

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

const HABITAT: Record<RoadKind, Habitat> = { grass: 'meadow', water: 'lake', forest: 'forest', mountain: 'cave' };
const ROAD_COLOR: Record<RoadKind, string> = { grass: '#e8d28a', water: '#4a90e2', forest: '#3f8f4f', mountain: '#a39aa6' };

/** How the scan screen should present the creature of a node. */
function sceneOf(m: TownMap, n: MapNode, foe: number): ScanParams {
  const mon = DEX.find((d) => d.id === foe)!;
  const boss = n.kind === 'city' || n.kind === 'league';
  const key = n.kind === 'wild' ? HABITAT[m.roads[n.road].kind] : n.kind === 'cave' || n.kind === 'forest' || n.kind === 'lake' ? n.kind : 'gym';
  return { kind: 'trek', boss, foe: mon, place: { key, types: n.types, maxRarity: 5, label: n.name, icon: n.kind === 'wild' ? undefined : n.icon } };
}

/** The town map: tap a place next to where you are, go there, and meet whoever lives there. */
export const trek: ScreenFactory = (root, ctx) => {
  if (!ctx.save.townmap) ctx.update((s) => ({ ...s, townmap: generateTownMap(Math.floor(Math.random() * 2 ** 31)) }));
  else if (ctx.save.townmap.entering !== null) ctx.update((s) => ({ ...s, townmap: retreat(s.townmap!) })); // came back without winning
  sfx.setMusic('map');
  let dead = false;
  let busy = false;
  let picked: number | null = null;
  const M = (): TownMap => ctx.save.townmap!;
  const m0 = M();
  const mon = partnerMon(ctx.save.players[Math.min(ctx.save.active, ctx.save.players.length - 1)], ctx.save.active);
  const H = m0.height;
  const pos = (p: { x: number; y: number }): string => `left:${p.x}%;top:${(p.y / H) * 100}%`;
  const N = (id: number): MapNode => m0.nodes[id];

  // ---- static drawing: sea with a grid of squares, land under the roads, the roads (only north, south, east, west) ----
  const cx = (c: number): number => Math.round((c + 0.5) * CELL * 10) / 10;
  const pts = (path: [number, number][]): string => path.map(([c, r]) => `${cx(c)},${cx(r)}`).join(' ');
  const landRoads = m0.roads.filter((r) => r.kind !== 'water');
  const svg = `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><path d="M${CELL} 0H0V${CELL}" fill="none" stroke="#b7dbee" stroke-width=".25"/></pattern></defs>
    <rect width="100" height="${H}" fill="#cfeaf7"/><rect width="100" height="${H}" fill="url(#grid)"/>
    ${m0.nodes.filter(isBig).map((p) => `<rect x="${cx(p.col) - (p.w / 2 + 0.35) * CELL}" y="${cx(p.row) - 0.85 * CELL}" width="${(p.w + 0.7) * CELL}" height="${1.7 * CELL}" rx="2.5" fill="#d6efb4"/>`).join('')}
    ${landRoads.map((r) => `<polyline points="${pts(r.path)}" fill="none" stroke="#d6efb4" stroke-width="${CELL * 0.85}" stroke-linejoin="round"/>`).join('')}
    ${m0.roads.map((r) => {
      const dash = r.kind === 'water' ? 'stroke-dasharray="1.2 2.2"' : r.kind === 'mountain' ? 'stroke-dasharray="3 1.6"' : '';
      return `<polyline points="${pts(r.path)}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" ${r.kind === 'water' ? 'opacity="0"' : ''}/>
        <polyline class="road" data-road="${r.id}" points="${pts(r.path)}" fill="none" stroke="${ROAD_COLOR[r.kind]}" stroke-width="${r.kind === 'water' ? 2.2 : 1.9}" stroke-linejoin="round" ${dash}/>`;
    }).join('')}
  </svg>`;
  const rowsN = Math.round(H / CELL);
  const fog = `<svg class="fog" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id="cloud"><stop offset="0" stop-color="#f4f7fa" stop-opacity=".98"/><stop offset=".62" stop-color="#eef2f7" stop-opacity=".94"/><stop offset="1" stop-color="#e6ecf3" stop-opacity="0"/></radialGradient></defs>
    ${Array.from({ length: rowsN }, (_, r) => Array.from({ length: COLS }, (_, c) => `<circle class="puff" data-k="${c},${r}" cx="${cx(c)}" cy="${cx(r)}" r="${CELL * 0.9}" fill="url(#cloud)"/>`).join('')).join('')}
  </svg>`;
  const labelAt = (r: TownMap['roads'][number]): { x: number; y: number } => {
    const [c, row] = r.path[Math.floor(r.path.length / 2)];
    return { x: cx(c) + 3.5, y: cx(row) };
  };

  root.innerHTML = `<div class="app" data-screen="trek">${bar('冒險')}
    <div class="mapnote"><b>${esc(m0.title)}　<small>${SIZE_NAME[m0.size]}</small></b><span class="muted" id="here"></span></div>
    <div class="mapwrap"><div class="mapbox" id="mapscroll"><div class="townmap" id="tm" style="aspect-ratio:100/${H}">
      ${svg}
      ${fog}
      ${m0.roads.map((r) => `<span class="rlabel" data-road="${r.id}" style="${pos(labelAt(r))}" hidden>${esc(r.name)}</span>`).join('')}
      ${m0.nodes.map((n) => `<button class="tnode ${isBig(n) ? 'big' : 'small'}${n.w > 1 ? ' wide' : ''}" data-id="${n.id}" data-kind="${n.kind}" style="${pos(n)}" aria-label="${esc(n.name)}"><i>${n.icon}</i>${isBig(n) ? `<span class="tname">${esc(n.name)}</span>` : ''}<span class="ttypes"></span><em class="gift" hidden>🎁</em></button>`).join('')}
      <div class="partner" id="partner"><img src="${artUrl(mon.id)}" alt="" onerror="this.style.visibility='hidden'"></div>
    </div></div>
      <div class="zoombar"><button id="zin" aria-label="放大">＋</button><button id="zout" aria-label="縮小">－</button><button id="zme" aria-label="回到我的位置">🎯</button></div></div>
    <div class="tpanel" id="panel"></div></div>`;

  const tm = root.querySelector<HTMLElement>('#tm')!;
  const box = root.querySelector<HTMLElement>('#mapscroll')!;
  const partner = root.querySelector<HTMLElement>('#partner')!;
  const panel = root.querySelector<HTMLElement>('#panel')!;

  function toast(text: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    root.querySelector('.app')!.appendChild(t);
    window.setTimeout(() => t.remove(), 1800);
  }

  function placePartner(): void {
    const a = N(M().at);
    partner.style.left = `${a.x}%`;
    partner.style.top = `${(a.y / H) * 100}%`;
  }

  // ---- zoom, pan and focus: the map is as wide as `zoom` screens and is never shrunk to fit ------------------
  const MARGIN_X = 10, MARGIN_Y = 6;
  let zoom = lastZoom;
  const baseWidth = (): number => Math.max(200, box.clientWidth - MARGIN_X * 2);
  const applyWidth = (): void => { tm.style.width = `${Math.round(baseWidth() * zoom)}px`; };
  /** zoom to `z`, keeping the map point under (ax, ay) — a point of the scroll box — where it is */
  function zoomTo(z: number, ax = box.clientWidth / 2, ay = box.clientHeight / 2): void {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    if (Math.abs(next - zoom) < 0.001) return;
    const ratio = next / zoom;
    const px = box.scrollLeft + ax, py = box.scrollTop + ay;
    zoom = lastZoom = next;
    applyWidth();
    box.scrollLeft = MARGIN_X + (px - MARGIN_X) * ratio - ax;
    box.scrollTop = MARGIN_Y + (py - MARGIN_Y) * ratio - ay;
  }
  /** put a place in the middle of the view (a little below the middle, the partner stands above it) */
  function focusOn(id: number, smooth: boolean): void {
    const n = N(id);
    box.scrollTo({
      left: Math.max(0, MARGIN_X + (n.x / 100) * tm.offsetWidth - box.clientWidth / 2),
      top: Math.max(0, MARGIN_Y + (n.y / H) * tm.offsetHeight - box.clientHeight * 0.55),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  // one finger drags the map, two fingers pinch it, ctrl + wheel zooms; a drag does not count as a tap
  const fingers = new Map<number, { x: number; y: number }>();
  let moved = 0, pinch0 = 0, pinchZoom = 1;
  const spread = (): number => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  box.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 1) moved = 0;
    if (fingers.size === 2) { pinch0 = spread(); pinchZoom = zoom; }
  });
  box.addEventListener('pointermove', (e) => {
    const prev = fingers.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    fingers.set(e.pointerId, now);
    if (fingers.size === 1) {
      moved += Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y);
      if (moved > 8) { box.scrollLeft -= now.x - prev.x; box.scrollTop -= now.y - prev.y; }
    } else if (fingers.size === 2 && pinch0 > 0) {
      moved = 99;
      const [a, b] = [...fingers.values()];
      const rect = box.getBoundingClientRect();
      zoomTo(pinchZoom * (spread() / pinch0), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
    }
  });
  const lift = (e: PointerEvent): void => { fingers.delete(e.pointerId); pinch0 = 0; };
  box.addEventListener('pointerup', lift);
  box.addEventListener('pointercancel', lift);
  box.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  box.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = box.getBoundingClientRect();
    zoomTo(zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
  root.querySelector('#zin')!.addEventListener('click', () => zoomTo(zoom * 1.25));
  root.querySelector('#zout')!.addEventListener('click', () => zoomTo(zoom / 1.25));
  root.querySelector('#zme')!.addEventListener('click', () => focusOn(M().at, true));
  const onResize = (): void => { applyWidth(); focusOn(M().at, false); };
  window.addEventListener('resize', onResize);

  const typeDots = (n: MapNode): string => n.types.map((t) => `<b style="background:${TYPES[t]?.color ?? '#999'}" title="${esc(TYPES[t]?.name ?? t)}"></b>`).join('');
  const typeNames = (n: MapNode): string => n.types.map((t) => TYPES[t]?.name ?? t).join('、');

  function render(): void {
    const m = M();
    const here = N(m.at);
    const near = new Set(neighbors(m, m.at));
    root.querySelector('#here')!.textContent = `${here.icon || '📍'} ${here.name}`;
    root.querySelectorAll<HTMLElement>('.tnode').forEach((el) => {
      const id = Number(el.dataset.id);
      const n = N(id);
      el.dataset.state = id === m.at ? 'here' : near.has(id) ? 'out' : m.visited.includes(id) ? 'seen' : 'far';
      el.dataset.done = m.cleared.includes(id) ? '1' : '0';
      el.dataset.pick = picked === id ? '1' : '0';
      const shown = isRevealed(m, id) && n.types.length > 0;
      el.querySelector('.ttypes')!.innerHTML = shown ? typeDots(n) : '';
      el.dataset.known = shown ? '1' : '0';
      if (!isBig(n)) el.style.setProperty('--ring', shown ? (TYPES[n.types[0]]?.color ?? '#9fb3c8') : '#9fb3c8');
      (el.querySelector('.gift') as HTMLElement).hidden = !(n.gift && !m.gifts.includes(id) && m.visited.includes(id) && id !== m.at);
    });
    // the clouds: every cell without a cloud over it is lit, and what stands in a cloud cannot be seen or tapped
    const clear = clearCells(m);
    const vis = visibleNodes(m);
    root.querySelectorAll<SVGElement>('.puff').forEach((el) => el.classList.toggle('gone', clear.has(el.dataset.k!)));
    root.querySelectorAll<HTMLElement>('.tnode').forEach((el) => { el.dataset.fog = vis.has(Number(el.dataset.id)) ? '0' : '1'; });
    root.querySelectorAll<HTMLElement>('.rlabel').forEach((el) => {
      const r = m0.roads[Number(el.dataset.road)];
      const [c, row] = r.path[Math.floor(r.path.length / 2)];
      el.hidden = !clear.has(`${c},${row}`);
    });
    root.querySelectorAll<SVGElement>('.road').forEach((el) => {
      const r = m0.roads[Number(el.dataset.road)];
      el.classList.toggle('walked', r.nodes.every((id) => m.cleared.includes(id)));
    });
    placePartner();
    renderPanel();
  }

  function renderPanel(): void {
    const m = M();
    const here = N(m.at);
    if (picked !== null) {
      const n = N(picked);
      const fight = needsFight(m, picked);
      const who = n.kind === 'town' ? '安全的城鎮，可以休息一下' :
        !fight ? '這裡的寶可夢已經打敗了' :
        isRevealed(m, picked) ? `住著「${esc(typeNames(n))}」系的寶可夢` : '住著誰？到了才知道（城鎮可以撥開烏雲）';
      const extra = n.kind === 'city' ? '　·　道館首領在這裡！' : n.kind === 'league' ? '　·　冠軍在這裡！' : '';
      const title = n.kind === 'wild' ? `${roadIcon[m0.roads[n.road].kind]} ${esc(n.name)}` : `${n.icon} ${esc(n.name)} <small>${kindLabel[n.kind]}</small>`;
      panel.innerHTML = `<div class="ttitle">${title}</div><div class="tsub">${who}${extra}</div>
        <div class="trow"><button class="btn" id="go">${fight ? '前往！' : '走過去'}</button></div>`;
      panel.querySelector('#go')!.addEventListener('click', () => void goTo(picked!));
      return;
    }
    if (atTown(m)) {
      const svc = [
        canGift(m) ? '<button class="btn" id="svc-gift">🎁 拿小禮物</button>' : '',
        canInfo(m) ? '<button class="btn" id="svc-info">☁️ 撥開烏雲</button>' : '',
        canQuiz(m) ? '<button class="btn" id="svc-quiz">💬 村民考考你</button>' : '',
      ].join('');
      panel.innerHTML = `<div class="ttitle">${here.icon} ${esc(here.name)} <small>${kindLabel[here.kind]}</small></div>
        <div class="tsub">${svc ? '這裡可以做的事：' : '都做完了！點亮著的地方繼續走'}</div>${svc ? `<div class="trow wrap">${svc}</div>` : ''}`;
      panel.querySelector('#svc-gift')?.addEventListener('click', openGift);
      panel.querySelector('#svc-info')?.addEventListener('click', () => {
        sfx.play('good');
        ctx.update((s) => ({ ...s, townmap: useInfo(s.townmap!) }));
        toast('烏雲散開了，附近的寶可夢屬性都看得到！');
        render();
      });
      panel.querySelector('#svc-quiz')?.addEventListener('click', () => ctx.go('practice', { quiz: true }));
      return;
    }
    panel.innerHTML = `<div class="ttitle">${here.kind === 'wild' ? '📍' : here.icon} ${esc(here.name)}</div><div class="tsub">點亮著的地方，再按「前往」</div>`;
  }

  function pick(id: number): void {
    const m = M();
    if (busy || id === m.at) return;
    if (!neighbors(m, m.at).includes(id)) { toast('太遠了，先走到相鄰的地方'); return; }
    sfx.play('select');
    picked = id;
    render();
  }

  /** the creature of a node is rolled once and then remembered, so backing out doesn't re-roll it */
  function foeFor(id: number): number {
    const m = M();
    const known = m.foes[id];
    if (known) return known;
    const n = N(id);
    const owned = new Set(ctx.save.caught);
    const pickMon = pickEncounter(ctx.rng, { rarity: rollRarity(ctx.rng, catOf(n), progressOf(m, n)), types: n.types, owned });
    ctx.update((s) => ({ ...s, townmap: rememberFoe(s.townmap!, id, pickMon.id) }));
    return pickMon.id;
  }

  async function goTo(id: number): Promise<void> {
    if (busy || dead) return;
    busy = true;
    picked = null;
    const m = M();
    if (needsFight(m, id)) {
      ctx.update((s) => ({ ...s, townmap: startEntering(s.townmap!, id) }));
      const a = N(id);
      partner.style.left = `${a.x}%`;
      partner.style.top = `${(a.y / H) * 100}%`;
      sfx.play('warn');
      await sleep(600);
      if (!dead) ctx.go('scan', sceneOf(M(), a, foeFor(id)));
      return;
    }
    ctx.update((s) => ({ ...s, townmap: moveTo(s.townmap!, id) }));
    sfx.play('step');
    render();
    focusOn(M().at, true);
    await sleep(450);
    busy = false;
    if (!dead && atTown(M()) && (canGift(M()) || canInfo(M()))) toast('到城鎮了！');
  }

  function openGift(): void {
    const m = M();
    const relic = nextRelic(ctx.save.relics, ctx.save.treks * 7 + m.at * 3 + m.seed % 97);
    sfx.play('chest');
    ctx.update((s) => ({ ...s, relics: s.relics.includes(relic.id) ? s.relics : [...s.relics, relic.id], townmap: takeGift(s.townmap!) }));
    render();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="card" style="text-align:center"><div class="relic">${relic.icon}</div><div class="big">${esc(relic.zh)}</div><div class="muted">${esc(relic.name)}</div><button class="btn" data-close>收下！</button></div>`;
    el.querySelector('[data-close]')!.addEventListener('click', () => el.remove());
    root.querySelector('.app')!.appendChild(el);
  }

  root.querySelectorAll<HTMLElement>('.tnode').forEach((el) => el.addEventListener('click', () => pick(Number(el.dataset.id))));

  applyWidth();
  placePartner();
  render();
  focusOn(M().at, false); // open on the party, zoomed in
  return { destroy: () => { dead = true; window.removeEventListener('resize', onResize); } };
};
