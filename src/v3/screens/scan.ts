import { startCamera, CameraFailure, type CameraHandle } from '../../gfx/camera';
import { analyzeColors, pickMon, type Swatch } from '../../mon/colorpick';
import { artUrl, pickWild, typeOf, type Mon } from '../../mon/dex';
import { sfx, say } from '../../audio/sfx';
import { bar, esc, type ScanParams, type ScreenFactory } from '../ctx';

const N = 48;

/** Point the camera at something: its colours decide which creature turns up. */
export const scan: ScreenFactory = (root, ctx, params: ScanParams) => {
  let cam: CameraHandle | null = null;
  let dead = false;
  const back = params.kind === 'toddler' ? 'home' : 'trek';
  const rarity = params.boss ? { minRarity: 3 } : params.kind === 'toddler' ? { maxRarity: 2 } : { maxRarity: 3 };
  const owned = new Set(ctx.save.caught);

  const stop = (): void => { cam?.stop(); cam = null; };

  function ask(msg = ''): void {
    stop();
    root.innerHTML = `<div class="app" data-screen="scan">${bar(params.boss ? '首領出沒！' : '拍照找寶可夢', back)}
      <div class="screen" style="justify-content:center;text-align:center;gap:14px">
        <div class="card"><div style="font-size:3rem">📷</div>
          <p><b>拍一拍身邊的東西</b><br>顏色會決定遇到哪一隻寶可夢！</p>
          ${msg ? `<p class="note">${esc(msg)}</p>` : ''}</div></div>
      <button class="btn" id="cam">打開相機</button>
      <button class="btn ghost" id="summon">不用相機，直接召喚</button></div>`;
    root.querySelector('#cam')!.addEventListener('click', openCamera);
    root.querySelector('#summon')!.addEventListener('click', () => {
      const mon = pickWild(ctx.rng, { owned, ...rarity });
      reveal(mon, [], null);
    });
  }

  async function openCamera(): Promise<void> {
    try {
      cam = await startCamera();
    } catch (e) {
      ask(e instanceof CameraFailure && e.code === 'denied' ? '相機被擋住了，請允許使用，或直接召喚' : '這裡不能用相機，直接召喚吧');
      return;
    }
    if (dead) { stop(); return; }
    root.innerHTML = `<div class="app" data-screen="scan">${bar('對準一個東西', back)}
      <div class="viewfinder" id="vf"><div class="aim"></div></div>
      <button class="shutter" id="shot" aria-label="拍照"></button></div>`;
    const vf = root.querySelector('#vf')!;
    cam.video.style.transform = cam.mirrored ? 'scaleX(-1)' : '';
    vf.prepend(cam.video);
    root.querySelector('#shot')!.addEventListener('click', capture);
  }

  function capture(): void {
    if (!cam) return;
    const v = cam.video;
    const w = v.videoWidth || 640, h = v.videoHeight || 480, s = Math.min(w, h);
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(v, (w - s) / 2, (h - s) / 2, s, s, 0, 0, N, N);
    const px = c.getImageData(0, 0, N, N).data;
    sfx.play('shutter');
    stop();
    const a = analyzeColors(px, N);
    const pick = pickMon(a.pal, ctx.rng, { owned, ...rarity });
    reveal(pick.mon, a.pal, pick.night);
  }

  function reveal(mon: Mon, pal: Swatch[], night: boolean | null): void {
    const t = typeOf(mon);
    const word = pal[0]?.word;
    const isNew = !ctx.save.caught.includes(mon.id);
    root.innerHTML = `<div class="app" data-screen="reveal" style="--type:${t.color}">${bar(night ? '夜裡有東西在動…' : '出現了！', back)}
      <div class="reveal">
        ${pal.length ? `<div class="swatches">${pal.slice(0, 3).map((c) => `<i style="background:rgb(${c.rgb.join(',')})"></i>`).join('')}</div>
          <div class="muted">拍到的顏色：${esc(word?.zh ?? '')} <b>${esc(word?.en ?? '')}</b></div>` : ''}
        <img class="sil" id="art" src="${artUrl(mon.id)}" alt="">
        <div class="name" id="nm">？？？</div>
        <div><span class="chip" style="background:${t.color}">${t.name}</span> <span class="stars">${'★'.repeat(mon.rarity)}${'☆'.repeat(5 - mon.rarity)}</span> ${isNew ? '<span class="newmon">NEW</span>' : ''}</div>
      </div>
      <button class="btn" id="go" disabled>${params.kind === 'toddler' ? '一起玩！' : params.boss ? '挑戰首領！' : '戰鬥！'}</button>
      <button class="btn ghost" id="again">再拍一次</button></div>`;
    sfx.play('appear');
    if (word && params.kind === 'toddler') say(word.en, 0.7);
    window.setTimeout(() => {
      const art = root.querySelector('#art') as HTMLImageElement | null;
      if (!art) return;
      art.className = 'shown';
      root.querySelector('#nm')!.textContent = mon.name;
      (root.querySelector('#go') as HTMLButtonElement).disabled = false;
      sfx.play('good');
    }, 900);
    root.querySelector('#go')!.addEventListener('click', () => {
      if (params.kind === 'toddler') ctx.go('toddler', { foe: mon });
      else ctx.go('battle', { foe: mon, boss: !!params.boss, trek: true });
    });
    root.querySelector('#again')!.addEventListener('click', () => ask());
  }

  ask();
  return { destroy: () => { dead = true; stop(); } };
};
