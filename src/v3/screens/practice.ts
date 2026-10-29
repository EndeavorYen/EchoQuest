import { pickPractice } from '../../game/deck';
import { record } from '../../game/progress';
import type { Level } from '../../game/model';
import { LEVELS, type Word } from '../../data/words';
import { judge } from '../../speech/match';
import { knownHearings, learnHearing } from '../../speech/learn';
import { logHeard } from '../../speech/heardlog';
import { Speaker, type SpeakResult } from '../../speech/speaker';
import { sfx, sayWord, stopSay } from '../../audio/sfx';
import { artUrl, typeOf } from '../../mon/dex';
import { partnerMon } from '../partner';
import { WordPanel } from '../battle-view';
import { bar, esc, type ScreenFactory } from '../ctx';

const MAX_TRIES = 3;

/** Say words with no monster and no clock: a gentle place to get a hard word right. */
export const practice: ScreenFactory = (root, ctx) => {
  let seat = Math.min(ctx.save.active, ctx.save.players.length - 1);
  let level = ctx.save.players[seat].level as Level;
  let word: Word | null = null;
  let tries = 0;
  let heard: string[] = [];
  let typing = false;
  let busy = false;
  let right = 0;
  let recent: string[] = [];
  let timer = 0;
  const speaker = new Speaker(ctx.rec);

  root.innerHTML = `<div class="app" data-screen="practice">${bar('練習')}
    <div class="seg" id="seats"></div><div class="seg" id="levels"></div>
    <div class="arena" id="arena" style="min-height:150px;flex:0 0 150px"><div class="mon me" id="me" style="left:50%;transform:translateX(-50%);width:34%;bottom:6%"></div>
      <div class="plate foe" style="min-width:0"><div class="nm" id="score">答對 0 個</div></div></div>
    <div id="panel"></div></div>`;
  const panel = new WordPanel(root.querySelector('#panel') as HTMLElement);

  function header(): void {
    const p = ctx.save.players[seat];
    const m = partnerMon(p, seat);
    (root.querySelector('#arena') as HTMLElement).style.setProperty('--type', typeOf(m).color);
    (root.querySelector('#me') as HTMLElement).innerHTML = `<img src="${artUrl(m.id)}" alt="" onerror="this.style.visibility='hidden'">`;
    (root.querySelector('#score') as HTMLElement).textContent = `答對 ${right} 個`;
    (root.querySelector('#seats') as HTMLElement).innerHTML = ctx.save.players.length > 1 ? ctx.save.players.map((q, i) => `<button class="${i === seat ? 'on' : ''}" data-seat="${i}">${esc(q.name)}</button>`).join('') : '';
    (root.querySelector('#levels') as HTMLElement).innerHTML = LEVELS.map((l) => `<button class="${l.lv === level ? 'on' : ''}" data-lv="${l.lv}">${esc(l.name)}</button>`).join('');
  }

  function deal(): void {
    busy = false;
    const p = ctx.save.players[seat];
    word = pickPractice(p, level, Date.now(), ctx.rng, recent);
    recent = [...recent.slice(-8), word.id];
    tries = 0; heard = []; typing = false;
    show('說出這個單字');
    sayWord(word.w, word.zh);
  }

  function show(note = ''): void {
    if (!word) return;
    panel.showWord({ mode: 'speak', word, hint: '跟著念一念', note, showConfirm: tries >= 1, listening: speaker.listening, typing, micLabel: '按下去，說說看' });
  }

  function mark(ok: boolean): void {
    if (!word) return;
    const w = word;
    ctx.update((s) => ({ ...s, players: s.players.map((p, i) => (i === seat ? { ...p, progress: record(p.progress, w.id, ok, Date.now()) } : p)) }));
  }

  function pass(): void {
    busy = true;
    mark(true);
    right += 1;
    sfx.play('perfect');
    header();
    panel.showWait('答對了！');
    timer = window.setTimeout(deal, 1100);
  }

  function answer(r: SpeakResult): void {
    if (!word || busy) return;
    if (r.kind === 'fail') { show(r.reason === 'no-speech' ? '沒聽到，再按一次麥克風' : r.reason === 'denied' ? '麥克風被擋住了，請改用鍵盤' : '再試一次！'); return; }
    const cand = r.kind === 'heard' ? r.candidates : [r.text];
    const j = judge(word.w, cand, level, knownHearings(ctx.save.aliases, word));
    logHeard({ w: word.w, c: cand, r: j.tier, lv: level });
    heard = cand; typing = false;
    if (j.tier !== 'miss') return pass();
    tries += 1;
    if (tries >= MAX_TRIES) {
      busy = true;
      mark(false);
      sfx.play('miss');
      panel.showWait(`答案是「${word.w}」，下次再來！`);
      sayWord(word.w, word.zh);
      timer = window.setTimeout(deal, 1600);
    } else {
      sfx.play('miss');
      show(`聽到「${j.heard || '…'}」，再試一次！`);
    }
  }

  panel.onHear = () => { if (word) sayWord(word.w, word.zh); };
  panel.onKeyboard = () => { speaker.cancel(); typing = true; show(); };
  panel.onSubmitTyped = (t) => answer({ kind: 'typed', text: t });
  panel.onConfirm = () => {
    if (!word || busy) return;
    if (heard.length) { const w = word; ctx.update((s) => ({ ...s, aliases: learnHearing(s.aliases, w, heard) })); logHeard({ w: word.w, c: heard, r: 'confirmed', lv: level }); }
    pass();
  };
  panel.onMic = () => {
    if (!word || busy) return;
    stopSay();
    if (speaker.listening) { speaker.cancel(); show(); return; }
    speaker.listen(answer, [word.w, ...knownHearings(ctx.save.aliases, word)]);
    show('聽著…');
    const poll = (): void => { if (speaker.listening) { if (speaker.interim) panel.setNote(`“${speaker.interim}”`); window.setTimeout(poll, 150); } };
    poll();
  };

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const s = t.closest('[data-seat]') as HTMLElement | null;
    const l = t.closest('[data-lv]') as HTMLElement | null;
    if (s) { seat = Number(s.dataset.seat); level = ctx.save.players[seat].level as Level; header(); speaker.cancel(); window.clearTimeout(timer); deal(); }
    if (l) { level = Number(l.dataset.lv) as Level; header(); speaker.cancel(); window.clearTimeout(timer); deal(); }
  });

  header();
  deal();
  return { destroy: () => { window.clearTimeout(timer); speaker.cancel(); stopSay(); } };
};
