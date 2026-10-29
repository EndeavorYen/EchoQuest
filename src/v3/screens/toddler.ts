import { artUrl, typeOf, MON_BY_ID, type Mon } from '../../mon/dex';
import { svg } from '../icons';
import evolutions from '../../data/mon/evolutions.json';
import { sfx, say } from '../../audio/sfx';
import { TODDLER_TAPS } from '../../game/toddler';
import { bar, esc, type Screen, type ScreenFactory } from '../ctx';

const NUMS = ['one', 'two', 'three', 'four', 'five'];
const EVO = evolutions as Record<string, { from?: number; to?: number[] }>;

/** The creature and the forms it grows into, up to three stages. */
export function growthChain(m: Mon): Mon[] {
  const out: Mon[] = [m];
  let cur = m.id;
  for (let i = 0; i < 2; i++) {
    const next = EVO[String(cur)]?.to?.[0];
    const nm = next ? MON_BY_ID.get(next) : undefined;
    if (!nm) break;
    out.push(nm);
    cur = nm.id;
  }
  return out;
}

/** Toddler mode: take a photo, a friend appears, tap it five times and it becomes a sticker. No words, no fighting. */
export const toddler: ScreenFactory = (root, ctx, params?: { foe?: Mon; book?: boolean }) => {
  if (params?.foe) return friend(params.foe);
  if (params?.book) return book();
  root.innerHTML = `<div class="app" data-screen="toddler">${bar('幼兒模式')}
    <div class="screen" style="justify-content:center;text-align:center">
      <div class="card"><div class="bigico">${svg('teddy')}</div><p><b>拍一張照片找朋友</b><br>點一點，牠就會長大變成貼紙！</p></div></div>
    <button class="btn" id="photo">拍照找朋友</button>
    <button class="btn ghost" id="stickers">貼紙本（${ctx.save.pals.length}）</button></div>`;
  root.querySelector('#photo')!.addEventListener('click', () => ctx.go('scan', { kind: 'toddler' }));
  root.querySelector('#stickers')!.addEventListener('click', () => ctx.go('toddler', { book: true }));

  function friend(foe: Mon): Screen {
    const chain = growthChain(foe);
    let taps = 0;
    const t = typeOf(foe);
    root.innerHTML = `<div class="app" data-screen="friend" style="--type:${t.color}">${bar('點點看！', 'home')}
      <div class="friend" id="stage"><img id="pal" src="${artUrl(foe.id)}" alt="${esc(foe.name)}" draggable="false" style="--s:.8;transform:scale(.8)"><div class="fx" id="fx"></div></div>
      <div class="dots">${Array.from({ length: TODDLER_TAPS }, () => '<i></i>').join('')}</div></div>`;
    const pal = root.querySelector('#pal') as HTMLImageElement;
    const dots = root.querySelectorAll('.dots i');
    const stage = root.querySelector('#stage') as HTMLElement;
    let done = false;

    stage.addEventListener('pointerdown', (e) => {
      if (done) return;
      taps += 1;
      dots[taps - 1]?.classList.add('on');
      const s = 0.8 + taps * 0.08;
      pal.style.setProperty('--s', String(s));
      pal.style.transform = `scale(${s})`;
      pal.classList.remove('boing');
      void pal.offsetWidth;
      pal.classList.add('boing');
      sparkle(e.clientX, e.clientY);
      sfx.play(taps === TODDLER_TAPS ? 'win' : 'tap');
      say(NUMS[taps - 1], 0.7);
      const stageIdx = Math.min(chain.length - 1, Math.floor(((taps - 1) * chain.length) / TODDLER_TAPS));
      if (pal.dataset.id !== String(chain[stageIdx].id)) {
        pal.src = artUrl(chain[stageIdx].id);
        pal.dataset.id = String(chain[stageIdx].id);
        if (stageIdx > 0) sfx.play('good');
      }
      if (taps >= TODDLER_TAPS) {
        done = true;
        const final = chain[chain.length - 1];
        pal.src = artUrl(final.id);
        ctx.update((s2) => ({ ...s2, pals: [final.id, ...s2.pals.filter((id) => id !== final.id)].slice(0, 60) }));
        window.setTimeout(() => ctx.go('toddler', { book: true }), 1500);
      }
    });

    function sparkle(cx: number, cy: number): void {
      const r = stage.getBoundingClientRect();
      for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.className = 'orb';
        p.style.cssText = `left:${cx - r.left}px;top:${cy - r.top}px;--c:${t.color};width:12px;height:12px;margin:-6px`;
        stage.querySelector('#fx')!.appendChild(p);
        const a = (i / 8) * Math.PI * 2;
        p.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 60}px,${Math.sin(a) * 60}px)`, opacity: 0 }], { duration: 600, easing: 'ease-out' }).onfinish = () => p.remove();
      }
    }
    return {};
  }

  function book(): Screen {
    const pals = ctx.save.pals;
    root.innerHTML = `<div class="app" data-screen="book">${bar('貼紙本', 'home')}
      <div class="scroll">${pals.length ? `<div class="sticker-grid">${pals.map((id, i) => `<div style="--r:${((i * 37) % 9) - 4}deg"><img src="${artUrl(id)}" alt="" onerror="this.style.visibility='hidden'"></div>`).join('')}</div>` : '<p class="muted" style="text-align:center">還沒有貼紙，去找朋友吧！</p>'}</div>
      <button class="btn" id="more">再找一個朋友</button></div>`;
    root.querySelector('#more')!.addEventListener('click', () => ctx.go('scan', { kind: 'toddler' }));
    return {};
  }
};
