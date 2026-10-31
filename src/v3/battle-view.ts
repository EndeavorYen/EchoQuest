import { artUrl, typeOf, type Mon } from '../mon/dex';
import { gradeOf, type Grade } from '../mon/rarity';
import type { MemoryCard } from './rounds';
import { BALL_COLOR, BEATS, CAPTURE_MS, LAND_AT, LOCK_AT, SUCK_MS, WOBBLE_AT, WOBBLE_MS, type Beat } from './capture';
import { glyph, svg } from './icons';
import type { Word } from '../data/words';
import { blockSpark, dropShield, playMove, raiseShield, type FxHost } from './effects';

const BACK = '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
const SPEAKER = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const KEYBOARD = '<svg viewBox="0 0 24 24"><path d="M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-9 3h2v2h-2zm-3 0h2v2H8zM5 8h2v2H5zm2 8H5v-2h2zm9 0H8v-2h8zm3 0h-2v-2h2zm0-3h-2v-2h2zm0-3h-2V8h2z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

export type PanelMode = 'speak' | 'defend' | 'victory' | 'wait' | 'listen' | 'spell' | 'memory';

export interface PartyChip {
  img: string;
  color: string;
  level: number;
  on: boolean;
  /** a grown-up (shown with a badge) */
  adult?: boolean;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface WordOpts {
  mode: 'speak' | 'defend';
  word: Word;
  hint: string;
  revenge?: boolean;
  showConfirm?: boolean;
  /** the recogniser keeps failing: offer "I said it" and "skip" as big buttons */
  stuck?: boolean;
  listening?: boolean;
  typing?: boolean;
  note?: string;
  timer?: boolean;
  /** label on the microphone button when idle */
  micLabel?: string;
  /** a hard card: right = a critical hit */
  hard?: boolean;
}

/** The little banner on a hard card. */
const hardTag = (hard?: boolean): string => (hard ? `<div class="hardtag">${svg('sparkle')} 難字！答對就是必殺</div>` : '');

/** The white card with the word, the microphone and the helper buttons. Used by battles and practice. */
export class WordPanel {
  onMic: () => void = () => {};
  onHear: () => void = () => {};
  onKeyboard: () => void = () => {};
  onConfirm: () => void = () => {};
  onSkip: () => void = () => {};
  onPick: (i: number) => void = () => {};
  onTile: (i: number) => void = () => {};
  onFlip: (i: number) => void = () => {};
  onSubmitTyped: (text: string) => void = () => {};
  onNext: () => void = () => {};
  onLose: () => void = () => {};

  constructor(readonly el: HTMLElement) {
    el.className = 'panel';
    el.innerHTML = '<p class="hint" id="hint"></p><div id="body"></div>';
    el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!t) return;
      switch (t.dataset.act) {
        case 'mic': this.onMic(); break;
        case 'hear': this.onHear(); break;
        case 'kbd': this.onKeyboard(); break;
        case 'ok': this.onConfirm(); break;
        case 'skip': this.onSkip(); break;
        case 'pick': this.onPick(Number(t.dataset.i)); break;
        case 'tile': this.onTile(Number(t.dataset.i)); break;
        case 'flip': this.onFlip(Number(t.dataset.i)); break;
        case 'next': this.onNext(); break;
        case 'lose': this.onLose(); break;
        case 'send': this.submitTyped(); break;
      }
    });
    el.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') this.submitTyped();
    });
  }

  private $ = <T extends HTMLElement>(sel: string): T => this.el.querySelector(sel) as T;

  private submitTyped(): void {
    const input = this.$('#typed') as HTMLInputElement | null;
    const v = input?.value.trim();
    if (v) this.onSubmitTyped(v);
  }

  private setMode(mode: PanelMode, hard = false): void {
    this.el.className = `panel${mode === 'defend' ? ' defend' : ''}${hard ? ' hard' : ''}`;
    this.el.dataset.mode = mode;
  }

  showWord(opts: WordOpts): void {
    const { word, mode } = opts;
    this.setMode(mode, !!opts.hard);
    this.$('#hint').textContent = (opts.revenge ? '復仇！ ' : '') + opts.hint;
    // a word with a picture gets the picture box; one without gets no box at all (the meaning is printed under the word)
    const pic = word.icon ? `<div class="pic" data-act="hear">${word.icon}</div>` : '';
    const typing = opts.typing
      ? `<div class="typebox"><input id="typed" inputmode="latin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="輸入單字"><button class="small-btn ok" data-act="send" aria-label="送出">${CHECK}</button></div>`
      : '';
    const micBtn = opts.typing
      ? ''
      : `<button class="mic ${opts.listening ? 'live' : ''}" data-act="mic">${MIC}<span>${opts.listening ? '聽著…' : opts.micLabel ?? (mode === 'defend' ? '念出防禦咒語' : '按下去，說說看')}</span></button>`;
    this.$('#body').innerHTML = `${hardTag(opts.hard)}
      <div class="wordrow ${pic ? '' : 'nopic'}" data-act="hear">${pic}<div><div class="word" id="theWord">${esc(word.w)}</div><div class="zh">${esc(word.zh)}</div></div></div>
      ${opts.timer ? '<div class="timer"><i id="timerBar"></i></div>' : ''}
      <p class="note" id="note">${esc(opts.note ?? '')}</p>
      ${typing}
      ${opts.stuck ? `<div class="stuck"><button class="btn good" data-act="ok">我念對了</button><button class="btn ghost" data-act="skip">跳過這個字</button></div>` : ''}
      <div class="actions">
        <button class="small-btn" data-act="kbd" aria-label="用鍵盤">${KEYBOARD}</button>
        ${micBtn}
        ${opts.showConfirm && !opts.stuck ? `<button class="small-btn ok" data-act="ok" aria-label="他說對了" title="他說對了">${CHECK}</button>` : ''}
        <button class="small-btn" data-act="hear" aria-label="聽一次">${SPEAKER}</button>
      </div>`;
    if (opts.typing) (this.$('#typed') as HTMLInputElement | null)?.focus();
  }

  /** Hear it, pick it: a big replay button and two or three pictures (or meanings). */
  showListen(o: { word: Word; hint: string; mode: 'pic' | 'zh'; options: Word[]; wrong: string[]; hard?: boolean; note?: string }): void {
    this.setMode('listen', !!o.hard);
    this.$('#hint').textContent = o.hint;
    this.$('#body').innerHTML = `${hardTag(o.hard)}
      <button class="bigear" data-act="hear" aria-label="再聽一次">${SPEAKER}<span>再聽一次</span></button>
      <div class="lchoices n${o.options.length} m-${o.mode}">${o.options
        .map((w, i) => {
          const x = o.wrong.includes(w.id);
          return `<button class="choice${x ? ' x' : ''}" data-act="pick" data-i="${i}" data-id="${esc(w.id)}" ${x ? 'disabled' : ''}>${o.mode === 'pic' ? `<span class="cpic">${w.icon}</span>` : `<span class="czh">${esc(w.zh)}</span>`}</button>`;
        })
        .join('')}</div>
      <p class="note" id="note">${esc(o.note ?? '')}</p>`;
  }

  /** The right choice lights up. */
  markChoice(i: number, ok: boolean): void {
    this.el.querySelector(`[data-act=pick][data-i="${i}"]`)?.classList.add(ok ? 'ok' : 'x');
  }

  /** Fill in the letters: the word with gaps, and letter tiles underneath. */
  showSpell(o: { word: Word; hint: string; letters: string[]; blanks: number[]; filled: number; tiles: string[]; used: boolean[]; hard?: boolean; note?: string }): void {
    this.setMode('spell', !!o.hard);
    this.$('#hint').textContent = o.hint;
    const got = new Set(o.blanks.slice(0, o.filled));
    const open = new Set(o.blanks.slice(o.filled));
    const next = o.blanks[o.filled];
    const letters = o.letters
      .map((c, i) => (open.has(i) ? `<i class="gap${i === next ? ' next' : ''}"></i>` : `<b class="${got.has(i) ? 'got' : ''}">${esc(c)}</b>`))
      .join('');
    const pic = o.word.icon ? `<div class="pic" data-act="hear">${o.word.icon}</div>` : '';
    this.$('#body').innerHTML = `${hardTag(o.hard)}
      <div class="wordrow ${pic ? '' : 'nopic'}">${pic}<div><div class="word spellw" id="spellWord">${letters}</div><div class="zh">${esc(o.word.zh)}</div></div></div>
      <p class="note" id="note">${esc(o.note ?? '')}</p>
      <div class="tiles">${o.tiles.map((c, i) => `<button class="tile" data-act="tile" data-i="${i}" ${o.used[i] ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
      <div class="actions"><button class="small-btn" data-act="hear" aria-label="聽一次">${SPEAKER}</button></div>`;
  }

  shakeTile(i: number): void {
    this.el.querySelector(`[data-act=tile][data-i="${i}"]`)?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
      { duration: 280 },
    );
  }

  /** Memory match: six face-down cards. */
  showMemory(o: { hint: string; cards: MemoryCard[]; hard?: boolean; note?: string }): void {
    this.setMode('memory', !!o.hard);
    this.$('#hint').textContent = o.hint;
    this.$('#body').innerHTML = `${hardTag(o.hard)}
      <div class="memo">${o.cards
        .map((c, i) => `<button class="mcard" data-act="flip" data-i="${i}" data-word="${esc(c.word.id)}" aria-label="翻牌"><span class="mback">${svg('sparkle')}</span><span class="mfront f-${c.face}">${c.face === 'pic' ? c.word.icon ?? '' : esc(c.word.w)}</span></button>`)
        .join('')}</div>
      <p class="note" id="note">${esc(o.note ?? '')}</p>`;
  }

  /** Which memory cards are face up, and which pairs are done. */
  memoryState(open: number[], matched: string[]): void {
    this.el.querySelectorAll<HTMLElement>('.mcard').forEach((b, i) => {
      const done = matched.includes(b.dataset.word ?? '');
      b.classList.toggle('up', done || open.includes(i));
      b.classList.toggle('done', done);
    });
  }

  setNote(text: string): void {
    const n = this.$('#note');
    if (n) n.textContent = text;
  }

  setTimer(frac: number): void {
    const t = this.$('#timerBar');
    if (t) t.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  showWait(hint: string): void {
    this.setMode('wait');
    this.$('#hint').textContent = hint;
    this.$('#body').innerHTML = '<div style="height:96px"></div>';
  }

  showHtml(hint: string, html: string): void {
    this.setMode('victory');
    this.$('#hint').textContent = hint;
    this.$('#body').innerHTML = html;
  }
}


/** Pure DOM: builds the battle screen and exposes small methods the controller drives. */
export class BattleView {
  readonly root: HTMLElement;
  readonly panel: WordPanel;
  private $ = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;

  onMic: () => void = () => {};
  onHear: () => void = () => {};
  onKeyboard: () => void = () => {};
  onConfirm: () => void = () => {};
  onSkip: () => void = () => {};
  onPick: (i: number) => void = () => {};
  onTile: (i: number) => void = () => {};
  onFlip: (i: number) => void = () => {};
  onPartner: (i: number) => void = () => {};
  onSubmitTyped: (text: string) => void = () => {};
  onNext: () => void = () => {};
  onLose: () => void = () => {};
  onLeave: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="app" data-screen="battle">
        <div class="bar">
          <button class="flee-btn" data-act="leave" aria-label="逃走">${BACK}<span>逃走</span></button>
          <h1 id="title">野生的寶可夢出現了！</h1>
          <span class="stars" id="stars"></span>
        </div>
        <div class="arena" id="arena">
          <div class="plate foe"><div class="nm"><span id="foeName"></span><span class="chip" id="foeType"></span></div>
            <div class="shields" id="shields" hidden></div>
            <div class="status" id="status" hidden></div>
            <div class="hp"><i id="foeHp"></i></div><div class="hpnum" id="foeHpNum"></div></div>
          <div class="mon foe" id="foe"></div>
          <div class="mon me" id="me"></div>
          <div class="plate me"><div class="nm"><span id="meName"></span><span class="chip" id="meType"></span></div><div class="hearts" id="hearts" aria-label="愛心"></div>
            <div class="xpline" id="xpline"><span class="rank" id="meRank"></span><div class="xp"><i id="xpBar"></i></div></div></div>
          <div class="fx" id="fx"></div>
        </div>
        <div class="party" id="party"></div>
        <div id="panel"></div>
      </div>`;
    this.panel = new WordPanel(this.$('#panel'));
    this.panel.onMic = () => this.onMic();
    this.panel.onHear = () => this.onHear();
    this.panel.onKeyboard = () => this.onKeyboard();
    this.panel.onConfirm = () => this.onConfirm();
    this.panel.onSkip = () => this.onSkip();
    this.panel.onPick = (i) => this.onPick(i);
    this.panel.onTile = (i) => this.onTile(i);
    this.panel.onFlip = (i) => this.onFlip(i);
    this.panel.onSubmitTyped = (t) => this.onSubmitTyped(t);
    this.panel.onNext = () => this.onNext();
    this.panel.onLose = () => this.onLose();
    this.$('#party').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (b) this.onPartner(Number(b.dataset.i));
    });
    this.$('[data-act=leave]').addEventListener('click', () => this.onLeave());
  }

  // ---- creatures ------------------------------------------------------------

  private monImg(m: Mon): string {
    return `<img src="${artUrl(m.id)}" alt="${esc(m.name)}" draggable="false" onerror="this.outerHTML='<div class=fallback></div>'">`;
  }

  setFoe(m: Mon, boss = false): void {
    const t = typeOf(m);
    const foe = this.$('#foe');
    foe.classList.remove('faint');
    foe.getAnimations().forEach((a) => a.cancel());
    this.$('#fx').querySelectorAll('.ball, .cstar').forEach((e) => e.remove());
    foe.innerHTML = this.monImg(m) + '<div class="shield-rings" id="rings"></div>';
    this.ringLayers = 0;
    this.$('#foeName').textContent = m.name;
    const chip = this.$('#foeType');
    chip.textContent = t.name;
    chip.style.background = t.color;
    this.$('#stars').textContent = '★'.repeat(m.rarity) + '☆'.repeat(5 - m.rarity);
    this.$('#title').textContent = (boss ? '首領 ' : '野生的') + m.name;
    this.$('#arena').style.setProperty('--type', t.color);
    this.$('#arena').dataset.grade = gradeOf(m.rarity);
    this.root.style.setProperty('--type', t.color);
    this.setShields(0, 0);
  }

  /** The active partner's experience bar; a ★ per rank earned. */
  setXp(o: { frac: number; rank: number; stars: number; ready: boolean; max: boolean }): void {
    const line = this.$('#xpline');
    line.classList.toggle('ready', o.ready);
    line.classList.toggle('max', o.max);
    line.title = o.max ? '已經最強了' : o.ready ? '打贏就會成長' : '念對單字累積經驗';
    (this.$('#xpBar') as HTMLElement).style.width = `${Math.round(Math.max(0, Math.min(1, o.frac)) * 100)}%`;
    this.$('#meRank').textContent = o.rank ? '★'.repeat(o.rank) : '';
  }

  /** A hard word said right. */
  crit(): void {
    const b = document.createElement('div');
    b.className = 'banner crit';
    b.textContent = '必殺！';
    this.$('#fx').appendChild(b);
    const at = (s: number, o: number): Keyframe => ({ opacity: o, transform: `translate(-50%, -50%) scale(${s}) rotate(-6deg)` });
    b.animate([{ ...at(2, 0), offset: 0 }, { ...at(0.95, 1), offset: 0.2 }, { ...at(1, 1), offset: 0.7 }, { ...at(1.1, 0), offset: 1 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => b.remove();
    this.fxHost().flash('#ffb300', 0.35, 400);
  }

  /**
   * The partner evolves (a white silhouette flickering between the two forms, faster and faster, then
   * a flash and the new form) or, with nothing to evolve into, gains a star (a golden glow and a star).
   */
  evolve(o: { from: Mon; to: Mon; kind: 'evolve' | 'star'; stars: number }, beat: (b: 'pulse' | 'done', n: number) => void, done: () => void): void {
    const me = this.$('#me');
    me.getAnimations().forEach((a) => a.cancel());
    const at = this.center(me);
    if (o.kind === 'star') {
      me.innerHTML = this.monImg(o.from);
      const img = me.querySelector('img') as HTMLElement | null;
      img?.animate([{ filter: 'none' }, { filter: 'brightness(1.35) drop-shadow(0 0 16px #ffd54a)' }, { filter: 'none' }, { filter: 'brightness(1.35) drop-shadow(0 0 16px #ffd54a)' }, { filter: 'none' }], { duration: 1100 });
      beat('pulse', 0);
      window.setTimeout(() => beat('pulse', 3), 550);
      window.setTimeout(() => {
        this.fxHost().flash('#ffd54a', 0.45, 500);
        this.burst(at, '#ffd54a', 10);
        const s = this.spawn('float', at.x, at.y - 70, '#c98600');
        s.textContent = '★'.repeat(Math.max(1, o.stars));
        s.animate([{ transform: 'translate(-50%,-60px) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.3)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-10px) scale(1)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%,-20px) scale(1)', opacity: 0 }], { duration: 1500 }).onfinish = () => s.remove();
        beat('done', 0);
        window.setTimeout(done, 1300);
      }, 1150);
      return;
    }
    me.innerHTML = `${this.monImg(o.from).replace('<img ', '<img data-form="from" ')}${this.monImg(o.to).replace('<img ', '<img data-form="to" style="display:none" ')}`;
    const imgs = [...me.querySelectorAll('img')] as HTMLElement[];
    const white = 'brightness(0) invert(1) drop-shadow(0 0 14px #fff)';
    imgs.forEach((im) => im.animate([{ filter: 'none' }, { filter: white }], { duration: 600, fill: 'forwards' }));
    me.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 700, iterations: 5 });
    const gaps = [420, 360, 300, 250, 200, 160, 130, 110, 90, 80, 70, 60];
    let t = 650;
    gaps.forEach((g, i) => {
      t += g;
      window.setTimeout(() => {
        imgs.forEach((im, k) => { im.style.display = (i + k) % 2 === 0 ? 'none' : ''; });
        beat('pulse', i);
      }, t);
    });
    window.setTimeout(() => {
      imgs.forEach((im) => { im.style.display = im.dataset.form === 'to' ? '' : 'none'; });
      this.fxHost().flash('#ffffff', 0.95, 700);
      imgs.forEach((im) => im.animate([{ filter: white }, { filter: 'none' }], { duration: 700, fill: 'forwards' }));
      me.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
      this.burst(at, typeOf(o.to).color, 14);
      this.fxHost().shake(8, 400);
      this.$('#meName').textContent = o.to.name;
      beat('done', gaps.length);
      window.setTimeout(done, 1500);
    }, t + 250);
  }

  /** Stars flying out from a point. */
  private burst(at: { x: number; y: number }, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.spawn('cstar', at.x, at.y, color);
      s.innerHTML = svg('sparkle');
      const a = (i / n) * Math.PI * 2;
      const r = 64 + (i % 2) * 26;
      s.animate(
        [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1)`, opacity: 0 }],
        { duration: 800, easing: 'ease-out', fill: 'forwards' },
      ).onfinish = () => s.remove();
    }
  }

  /** A rare or legendary creature arrives: a banner, a flash and (for a legend) a rumble. */
  entrance(grade: Exclude<Grade, 'common'>, text: string): void {
    const legend = grade === 'legend';
    const b = document.createElement('div');
    b.className = `banner ${grade}`;
    b.textContent = text;
    this.$('#fx').appendChild(b);
    const at = (s: number, o: number): Keyframe => ({ opacity: o, transform: `translate(-50%, -50%) scale(${s})` });
    b.animate([{ ...at(0.4, 0), offset: 0 }, { ...at(1.12, 1), offset: 0.22 }, { ...at(1, 1), offset: 0.75 }, { ...at(1.2, 0), offset: 1 }], { duration: legend ? 2200 : 1600, easing: 'ease-out' }).onfinish = () => b.remove();
    this.fxHost().flash(legend ? '#ffd54a' : '#fff3b0', legend ? 0.55 : 0.4, 700);
    if (legend) this.fxHost().shake(10, 600);
  }

  /** Rattle the whole arena. */
  shake(px: number, ms = 260): void {
    this.fxHost().shake(px, ms);
  }

  setPartner(m: Mon): void {
    const t = typeOf(m);
    this.$('#me').innerHTML = this.monImg(m);
    this.$('#meName').textContent = m.name;
    const chip = this.$('#meType');
    chip.textContent = t.name;
    chip.style.background = t.color;
  }

  setParty(chips: PartyChip[]): void {
    this.$('#party').innerHTML = chips
      .map(
        (c, i) => `<button class="pbtn ${c.on ? 'on' : ''}" data-i="${i}" style="--type:${c.color}" aria-label="夥伴 ${i + 1}${c.adult ? '（大人）' : ''}">
          ${c.adult ? '<span class="adult">大人</span>' : ''}
          <img src="${c.img}" alt="" onerror="this.style.visibility='hidden'">
          <span class="lv">${[1, 2, 3, 4].map((n) => `<i class="${n <= c.level ? 'f' : ''}"></i>`).join('')}</span></button>`,
      )
      .join('');
  }

  setFoeHp(hp: number, max: number): void {
    const f = Math.max(0, Math.min(1, hp / max));
    const bar = this.$('#foeHp');
    bar.style.width = `${f * 100}%`;
    bar.className = f > 0.5 ? '' : f > 0.25 ? 'mid' : 'low';
    this.$('#foeHpNum').textContent = `${Math.max(0, Math.ceil(hp))} / ${max}`;
  }

  /** The party's hearts: lose them all and the fight is lost. */
  setHearts(n: number, max: number): void {
    const el = this.$('#hearts');
    el.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    el.dataset.left = String(n);
  }

  showDefeat(foe: Mon): void {
    this.panel.showHtml('', `<div class="victory">
      <div class="big">被${esc(foe.name)}打敗了…</div>
      <div class="zh">沒關係！回到上一格，換個辦法再來。</div>
      <button class="btn" data-act="lose">回到地圖</button></div>`);
  }

  /** The condition on the wild creature (burn, sleep…), or none. */
  setStatus(s: { zh: string; icon: string; color: string; left: number } | null): void {
    const el = this.$('#status');
    el.hidden = !s;
    if (s) {
      el.innerHTML = `${glyph(s.icon)} ${s.zh} ${s.left}`;
      el.style.setProperty('--c', s.color);
    }
  }

  private ringLayers = 0;

  /** Rings around the creature, one per shield layer; the outer ring pops when a layer breaks. */
  private drawRings(layers: number): void {
    const box = this.root.querySelector<HTMLElement>('#rings');
    if (!box) return;
    if (layers < this.ringLayers) {
      const gone = document.createElement('i');
      gone.className = 'pop';
      gone.style.setProperty('--k', String(this.ringLayers - 1));
      box.appendChild(gone);
      window.setTimeout(() => gone.remove(), 600);
    }
    box.querySelectorAll('i:not(.pop)').forEach((n) => n.remove());
    for (let k = 0; k < layers; k++) {
      const r = document.createElement('i');
      r.style.setProperty('--k', String(k));
      box.appendChild(r);
    }
    this.ringLayers = layers;
  }

  /** Boss shield: one pip per layer left. */
  setShields(layers: number, max: number): void {
    this.drawRings(layers);
    const el = this.$('#shields');
    el.hidden = max <= 0;
    el.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < layers ? 'on' : ''}"></i>`).join('') + (layers > 0 ? '<span>護盾</span>' : '<span>護盾破了！</span>');
  }

  // ---- panel (forwarded) ------------------------------------------------------

  showWord(opts: WordOpts): void { this.panel.showWord(opts); }
  showListen(o: Parameters<WordPanel['showListen']>[0]): void { this.panel.showListen(o); }
  markChoice(i: number, ok: boolean): void { this.panel.markChoice(i, ok); }
  showSpell(o: Parameters<WordPanel['showSpell']>[0]): void { this.panel.showSpell(o); }
  shakeTile(i: number): void { this.panel.shakeTile(i); }
  showMemory(o: Parameters<WordPanel['showMemory']>[0]): void { this.panel.showMemory(o); }
  memoryState(open: number[], matched: string[]): void { this.panel.memoryState(open, matched); }
  setNote(text: string): void { this.panel.setNote(text); }
  setTimer(frac: number): void { this.panel.setTimer(frac); }
  showWait(hint: string): void { this.panel.showWait(hint); }

  showVictory(foe: Mon, words: Word[], o: { isNew?: boolean; nextLabel?: string; grown?: string[] } = {}): void {
    this.panel.showHtml('', `<div class="victory">
      <div class="big">打倒了${esc(foe.name)}！</div>
      ${o.isNew ? `<div class="newmon">${svg('sparkle')} 新的圖鑑夥伴 ${svg('sparkle')}</div>` : ''}
      ${(o.grown ?? []).map((g) => `<div class="grown">${svg('sparkle')} ${esc(g)}</div>`).join('')}
      <div class="zh">學到的咒語</div>
      <div class="cards">${words.slice(0, 6).map((w) => `<span>${w.icon ?? ''} ${esc(w.w)}</span>`).join('') || '<span>—</span>'}</div>
      <button class="btn" data-act="next">${esc(o.nextLabel ?? '再遇見一隻')}</button></div>`);
  }

  // ---- effects --------------------------------------------------------------
  private center(el: HTMLElement): { x: number; y: number } {
    const a = this.$('#arena').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
  }

  private spawn(cls: string, x: number, y: number, color: string): HTMLElement {
    const e = document.createElement('div');
    e.className = cls;
    e.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
    this.$('#fx').appendChild(e);
    return e;
  }

  private host?: FxHost;

  private fxHost(): FxHost {
    return (this.host ??= {
      layer: this.$('#fx'),
      shake: (px, ms = 260) => {
        void this.$('#arena').animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: 'translate(0,0)' }], { duration: ms });
      },
      flash: (color, alpha = 0.3, ms = 300) => {
        const w = document.createElement('div');
        w.className = 'washfx';
        w.style.background = color;
        this.$('#fx').appendChild(w);
        void w.animate([{ opacity: alpha }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).finished.then(() => w.remove());
      },
      tint: (who, css, ms) => {
        const img = this.$(who === 'foe' ? '#foe' : '#me').querySelector('img') as HTMLElement | null;
        if (!img) return;
        img.style.transition = 'filter .15s';
        img.style.filter = css;
        window.setTimeout(() => { img.style.filter = ''; }, ms);
      },
    });
  }

  /** `who` fires its type's move at the other creature; `hit` runs at the moment of impact. */
  cast(who: 'me' | 'foe', style: string, colors: string[], power: 1 | 2, hit: () => void, aim: { dx: number; dy: number } = { dx: 0, dy: 0 }): void {
    const mine = who === 'me';
    const from = this.center(this.$(mine ? '#me' : '#foe'));
    const t = this.center(this.$(mine ? '#foe' : '#me'));
    const to = { x: t.x + aim.dx, y: t.y + aim.dy };
    if (!mine) {
      const foe = this.$('#foe');
      foe.classList.add('lunge');
      window.setTimeout(() => foe.classList.remove('lunge'), 520);
    }
    playMove(this.fxHost(), style, colors, from, to, power, hit);
  }

  /** A bubble around the partner while the block is up. */
  private shieldEl: HTMLElement | null = null;
  raiseShield(color: string): void {
    this.dropShield();
    this.shieldEl = raiseShield(this.fxHost(), this.center(this.$('#me')), color);
  }
  dropShield(): void {
    if (this.shieldEl) dropShield(this.shieldEl);
    this.shieldEl = null;
  }
  blockSpark(where: 'foe' | 'me', color: string): void {
    blockSpark(this.fxHost(), this.center(this.$(where === 'foe' ? '#foe' : '#me')), color);
  }

  /** The partner hops aside. */
  dodge(): void {
    const el = this.$('#me');
    el.classList.remove('dodge');
    void el.offsetWidth;
    el.classList.add('dodge');
    window.setTimeout(() => el.classList.remove('dodge'), 700);
  }

  /** The wild creature glows while it winds up. */
  setCharging(on: boolean): void {
    this.$('#foe').classList.toggle('charging', on);
  }

  flash(color: string, alpha = 0.3): void {
    this.fxHost().flash(color, alpha);
  }

  floatText(where: 'foe' | 'me', text: string, color: string, small = false, dy = 0): void {
    const p = this.center(this.$(where === 'foe' ? '#foe' : '#me'));
    const f = this.spawn(`float${small ? ' small' : ''}`, p.x, p.y - 40 + dy, color);
    f.textContent = text;
    f.animate([{ transform: 'translate(-50%,10px)', opacity: 0 }, { transform: 'translate(-50%,-6px)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-46px)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => f.remove();
  }

  hurt(where: 'foe' | 'me'): void {
    const el = this.$(where === 'foe' ? '#foe' : '#me');
    el.classList.remove('hurt');
    void el.offsetWidth;
    el.classList.add('hurt');
    window.setTimeout(() => el.classList.remove('hurt'), 500);
  }

  shakeMe(): void {
    const el = this.$('#me');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    window.setTimeout(() => el.classList.remove('shake'), 450);
  }

  /**
   * The win: the creature shrinks into a ball that drops, wobbles three times and locks, with a
   * burst of stars. `beat` fires at each step (for sound and vibration); `done` when it is over.
   */
  capture(o: { grade: Grade; isNew: boolean }, beat: (b: Beat) => void, done: () => void): void {
    const foe = this.$('#foe');
    const p = this.center(foe);
    const ground = Math.min(p.y + 90, this.$('#arena').clientHeight - 60);
    const dy = Math.max(30, ground - p.y);
    const color = BALL_COLOR[o.grade];
    const ball = this.spawn('ball', p.x, p.y, color);
    foe.animate(
      [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(.08)', opacity: 0, filter: 'brightness(4)' }],
      { duration: SUCK_MS, easing: 'ease-in', fill: 'forwards' },
    );
    // one timeline for the ball: appear, drop and bounce, three wobbles, a little swell when it locks
    const at: Array<[number, string]> = [
      [0, 'translate(0,0) scale(.2) rotate(0deg)'],
      [SUCK_MS, 'translate(0,0) scale(1) rotate(0deg)'],
      [LAND_AT, `translate(0,${dy}px) scale(1) rotate(0deg)`],
      [LAND_AT + 70, `translate(0,${dy - 14}px) scale(1) rotate(0deg)`],
      [WOBBLE_AT[0], `translate(0,${dy}px) scale(1) rotate(0deg)`],
    ];
    for (const s of WOBBLE_AT) {
      at.push([s + WOBBLE_MS * 0.25, `translate(0,${dy}px) rotate(-24deg)`], [s + WOBBLE_MS * 0.5, `translate(0,${dy}px) rotate(0deg)`], [s + WOBBLE_MS * 0.75, `translate(0,${dy}px) rotate(24deg)`], [s + WOBBLE_MS, `translate(0,${dy}px) rotate(0deg)`]);
    }
    at.push([LOCK_AT, `translate(0,${dy}px) scale(1)`], [LOCK_AT + 90, `translate(0,${dy}px) scale(1.18)`], [LOCK_AT + 220, `translate(0,${dy}px) scale(1)`], [CAPTURE_MS, `translate(0,${dy}px) scale(1)`]);
    const sorted = at.sort((a, b) => a[0] - b[0]);
    ball.animate(
      sorted.map(([t, transform]) => ({ transform, opacity: t === 0 ? 0 : 1, offset: t / CAPTURE_MS })),
      { duration: CAPTURE_MS, fill: 'forwards' },
    );
    for (const b of BEATS) {
      window.setTimeout(() => {
        beat(b);
        if (b.kind === 'lock') this.lockBall(ball, { x: p.x, y: p.y + dy }, color, o);
      }, b.at);
    }
    window.setTimeout(done, CAPTURE_MS);
  }

  private lockBall(ball: HTMLElement, at: { x: number; y: number }, color: string, o: { grade: Grade; isNew: boolean }): void {
    ball.classList.add('locked');
    this.fxHost().flash(color, 0.35, 450);
    const n = o.grade === 'legend' ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const s = this.spawn('cstar', at.x, at.y, color);
      s.innerHTML = svg('sparkle');
      const a = (i / n) * Math.PI * 2;
      const r = 62 + (i % 2) * 22;
      s.animate(
        [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1)`, opacity: 0 }],
        { duration: 750, easing: 'ease-out', fill: 'forwards' },
      ).onfinish = () => s.remove();
    }
    const f = this.spawn('float', at.x, at.y - 56, '#c98600');
    f.textContent = o.isNew ? '新收服！' : '收服！';
    f.animate([{ transform: 'translate(-50%,10px)', opacity: 0 }, { transform: 'translate(-50%,-4px)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-30px)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-40px)', opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => f.remove();
    if (o.isNew) {
      const g = this.spawn('float small', at.x, at.y - 22, '#18202e');
      g.textContent = '已加進圖鑑';
      g.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1300 }).onfinish = () => g.remove();
    }
  }

  faintFoe(): void {
    this.$('#foe').classList.add('faint');
  }
}
