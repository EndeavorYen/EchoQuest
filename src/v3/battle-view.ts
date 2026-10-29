import { artUrl, typeOf, type Mon } from '../mon/dex';
import { glyph, svg } from './icons';
import type { Word } from '../data/words';
import { blockSpark, dropShield, playMove, raiseShield, type FxHost } from './effects';

const BACK = '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
const SPEAKER = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const KEYBOARD = '<svg viewBox="0 0 24 24"><path d="M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-9 3h2v2h-2zm-3 0h2v2H8zM5 8h2v2H5zm2 8H5v-2h2zm9 0H8v-2h8zm3 0h-2v-2h2zm0-3h-2v-2h2zm0-3h-2V8h2z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

export type PanelMode = 'speak' | 'defend' | 'victory' | 'wait';

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
  listening?: boolean;
  typing?: boolean;
  note?: string;
  timer?: boolean;
  /** label on the microphone button when idle */
  micLabel?: string;
}

/** The white card with the word, the microphone and the helper buttons. Used by battles and practice. */
export class WordPanel {
  onMic: () => void = () => {};
  onHear: () => void = () => {};
  onKeyboard: () => void = () => {};
  onConfirm: () => void = () => {};
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

  private setMode(mode: PanelMode): void {
    this.el.className = `panel ${mode === 'defend' ? 'defend' : ''}`;
    this.el.dataset.mode = mode;
  }

  showWord(opts: WordOpts): void {
    const { word, mode } = opts;
    this.setMode(mode);
    this.$('#hint').textContent = (opts.revenge ? '復仇！ ' : '') + opts.hint;
    // a word with a picture gets the picture box; one without gets no box at all (the meaning is printed under the word)
    const pic = word.icon ? `<div class="pic" data-act="hear">${word.icon}</div>` : '';
    const typing = opts.typing
      ? `<div class="typebox"><input id="typed" inputmode="latin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="輸入單字"><button class="small-btn ok" data-act="send" aria-label="送出">${CHECK}</button></div>`
      : '';
    const micBtn = opts.typing
      ? ''
      : `<button class="mic ${opts.listening ? 'live' : ''}" data-act="mic">${MIC}<span>${opts.listening ? '聽著…' : opts.micLabel ?? (mode === 'defend' ? '念出防禦咒語' : '按下去，說說看')}</span></button>`;
    this.$('#body').innerHTML = `
      <div class="wordrow ${pic ? '' : 'nopic'}" data-act="hear">${pic}<div><div class="word" id="theWord">${esc(word.w)}</div><div class="zh">${esc(word.zh)}</div></div></div>
      ${opts.timer ? '<div class="timer"><i id="timerBar"></i></div>' : ''}
      <p class="note" id="note">${esc(opts.note ?? '')}</p>
      ${typing}
      <div class="actions">
        <button class="small-btn" data-act="kbd" aria-label="用鍵盤">${KEYBOARD}</button>
        ${micBtn}
        ${opts.showConfirm ? `<button class="small-btn ok" data-act="ok" aria-label="他說對了" title="他說對了">${CHECK}</button>` : ''}
        <button class="small-btn" data-act="hear" aria-label="聽一次">${SPEAKER}</button>
      </div>`;
    if (opts.typing) (this.$('#typed') as HTMLInputElement | null)?.focus();
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
          <div class="plate me"><div class="nm"><span id="meName"></span><span class="chip" id="meType"></span></div><div class="hearts" id="hearts" aria-label="愛心"></div></div>
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
    foe.innerHTML = this.monImg(m) + '<div class="shield-rings" id="rings"></div>';
    this.ringLayers = 0;
    this.$('#foeName').textContent = m.name;
    const chip = this.$('#foeType');
    chip.textContent = t.name;
    chip.style.background = t.color;
    this.$('#stars').textContent = '★'.repeat(m.rarity) + '☆'.repeat(5 - m.rarity);
    this.$('#title').textContent = (boss ? '首領 ' : '野生的') + m.name;
    this.$('#arena').style.setProperty('--type', t.color);
    this.root.style.setProperty('--type', t.color);
    this.setShields(0, 0);
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
  setNote(text: string): void { this.panel.setNote(text); }
  setTimer(frac: number): void { this.panel.setTimer(frac); }
  showWait(hint: string): void { this.panel.showWait(hint); }

  showVictory(foe: Mon, words: Word[], o: { isNew?: boolean; nextLabel?: string } = {}): void {
    this.panel.showHtml('', `<div class="victory">
      <div class="big">打倒了${esc(foe.name)}！</div>
      ${o.isNew ? `<div class="newmon">${svg('sparkle')} 新的圖鑑夥伴 ${svg('sparkle')}</div>` : ''}
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

  faintFoe(): void {
    this.$('#foe').classList.add('faint');
  }
}
