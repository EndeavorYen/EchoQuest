import { arrive, begin, generateTrail, options, stay, type Kind, type Stop, type Trail } from '../../game/trail';
import { nextRelic } from '../../game/run';
import { artUrl } from '../../mon/dex';
import { partnerMon } from '../partner';
import { sfx } from '../../audio/sfx';
import { bar, esc, type ScreenFactory } from '../ctx';

const ICON: Record<Kind, string> = { start: '🚩', monster: '🐾', rare: '🌟', chest: '🎁', boss: '👑' };
const LABEL: Record<Kind, string> = { start: '出發點', monster: '野生寶可夢', rare: '稀有寶可夢', chest: '寶箱', boss: '首領' };
const CTA: Record<Kind, string> = { start: '', monster: '拍照找寶可夢', rare: '拍照找稀有寶可夢', chest: '打開寶箱', boss: '挑戰首領！' };
const ROW_H = 88;

/** The branching trek map: pick which way to go; every map is generated fresh. */
export const trek: ScreenFactory = (root, ctx) => {
  if (!ctx.save.trail) ctx.update((s) => ({ ...s, trail: generateTrail(Math.floor(Math.random() * 2 ** 31), s.treks + 1) }));
  else if (ctx.save.trail.target !== null) ctx.update((s) => ({ ...s, trail: stay(s.trail!) })); // came back from a fight that didn't end in a win
  const trail: Trail = ctx.save.trail!;
  sfx.setMusic('map');

  const opts = options(trail);
  let sel: Stop | null = opts.length === 1 ? opts[0] : null;

  const rows = Math.max(...trail.stops.map((s) => s.row)) + 1;
  const H = rows * ROW_H;
  const width = (r: number): number => trail.stops.filter((s) => s.row === r).length;
  const xPct = (s: Stop): number => ((s.col + 0.5) / width(s.row)) * 100;
  const y = (s: Stop): number => H - (s.row + 0.5) * ROW_H;
  const mon = partnerMon(ctx.save.players[Math.min(ctx.save.active, ctx.save.players.length - 1)], ctx.save.active);

  function draw(): void {
    const isOpt = (s: Stop): boolean => opts.some((o) => o.id === s.id);
    const lines = trail.stops
      .flatMap((a) => a.next.map((n) => {
        const b = trail.stops[n];
        const walked = trail.cleared.includes(a.id) && trail.cleared.includes(b.id);
        const live = a.id === trail.at && isOpt(b);
        return `<line class="${walked ? 'walked' : live ? 'live' : ''}" x1="${xPct(a)}" y1="${y(a)}" x2="${xPct(b)}" y2="${y(b)}"/>`;
      }))
      .join('');
    const dots = trail.stops
      .map((s) => {
        const done = trail.cleared.includes(s.id);
        const here = s.id === trail.at;
        const cls = ['stop', s.kind, done && !here ? 'done' : '', here ? 'here' : '', isOpt(s) ? 'opt' : '', sel?.id === s.id ? 'sel' : ''].join(' ');
        const inner = here ? `<img src="${artUrl(mon.id)}" alt="" onerror="this.style.visibility='hidden'">` : done ? '✓' : ICON[s.kind];
        return `<button class="${cls}" data-stop="${s.id}" style="left:${xPct(s)}%;top:${y(s)}px" ${isOpt(s) ? '' : 'disabled'} aria-label="${LABEL[s.kind]}">${inner}</button>`;
      })
      .join('');
    const cta = sel ? CTA[sel.kind] : '選一條路';
    root.innerHTML = `<div class="app" data-screen="trek">${bar('冒險')}
      <div class="mapnote"><b>第 ${trail.region} 張地圖</b><span class="muted">亮起來的地方可以走${opts.length > 1 ? '，選一條路' : ''}</span></div>
      <div class="screen scroll" id="mapscroll"><div class="trail" style="height:${H}px">
        <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${dots}</div></div>
      <button class="btn" id="go" ${sel ? '' : 'disabled'}>${esc(cta)}</button></div>`;
    root.querySelectorAll<HTMLElement>('[data-stop]').forEach((b) => b.addEventListener('click', () => {
      sel = trail.stops[Number(b.dataset.stop)];
      sfx.play('select');
      draw();
    }));
    root.querySelector('#go')!.addEventListener('click', () => sel && start(sel));
    const box = root.querySelector<HTMLElement>('#mapscroll');
    const here = root.querySelector<HTMLElement>('.stop.here');
    if (box && here) box.scrollTop = Math.max(0, here.offsetTop - box.clientHeight * 0.6);
  }

  function start(s: Stop): void {
    ctx.update((st) => ({ ...st, trail: begin(st.trail!, s.id) }));
    if (s.kind === 'chest') return openChest(s);
    ctx.go('scan', { kind: 'trek', boss: s.kind === 'boss', rare: s.kind === 'rare' });
  }

  function openChest(s: Stop): void {
    const relic = nextRelic(ctx.save.relics, ctx.save.treks * 7 + s.id);
    sfx.play('chest');
    ctx.update((st) => ({ ...st, relics: st.relics.includes(relic.id) ? st.relics : [...st.relics, relic.id], trail: arrive(st.trail!, s.id) }));
    root.innerHTML = `<div class="app" data-screen="chest">${bar('寶箱', null)}
      <div class="screen" style="justify-content:center;align-items:center;text-align:center">
        <div class="relic">${relic.icon}</div><div class="big">${esc(relic.zh)}</div><div class="muted">${esc(relic.name)}</div></div>
      <button class="btn" data-go="trek">繼續冒險</button></div>`;
  }

  draw();
};
