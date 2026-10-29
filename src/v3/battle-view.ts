import { artUrl, typeOf, type Mon } from '../mon/dex';
import type { Word } from '../data/words';

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
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Pure DOM: builds the battle screen and exposes small methods the controller drives. */
export class BattleView {
  readonly root: HTMLElement;
  private $ = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;

  onMic: () => void = () => {};
  onHear: () => void = () => {};
  onKeyboard: () => void = () => {};
  onConfirm: () => void = () => {};
  onPartner: (i: number) => void = () => {};
  onSubmitTyped: (text: string) => void = () => {};
  onNext: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="app" data-screen="battle">
        <div class="bar">
          <h1 id="title">野生的寶可夢出現了！</h1>
          <span class="stars" id="stars"></span>
        </div>
        <div class="arena" id="arena">
          <div class="plate foe"><div class="nm"><span id="foeName"></span><span class="chip" id="foeType"></span></div>
            <div class="hp"><i id="foeHp"></i></div><div class="hpnum" id="foeHpNum"></div></div>
          <div class="mon foe" id="foe"></div>
          <div class="mon me" id="me"></div>
          <div class="plate me"><div class="nm"><span id="meName"></span><span class="chip" id="meType"></span></div></div>
          <div class="fx" id="fx"></div>
        </div>
        <div class="party" id="party"></div>
        <div class="panel" id="panel">
          <p class="hint" id="hint"></p>
          <div id="body"></div>
        </div>
      </div>`;
    this.$('#party').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (b) this.onPartner(Number(b.dataset.i));
    });
    this.$('#panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!t) return;
      switch (t.dataset.act) {
        case 'mic': this.onMic(); break;
        case 'hear': this.onHear(); break;
        case 'kbd': this.onKeyboard(); break;
        case 'ok': this.onConfirm(); break;
        case 'next': this.onNext(); break;
        case 'send': this.submitTyped(); break;
      }
    });
    this.$('#panel').addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') this.submitTyped();
    });
  }

  private submitTyped(): void {
    const input = this.$('#typed') as HTMLInputElement | null;
    const v = input?.value.trim();
    if (v) this.onSubmitTyped(v);
  }

  // ---- creatures ------------------------------------------------------------

  private monImg(m: Mon): string {
    return `<img src="${artUrl(m.id)}" alt="${esc(m.name)}" draggable="false" onerror="this.outerHTML='<div class=fallback></div>'">`;
  }

  setFoe(m: Mon): void {
    const t = typeOf(m);
    this.$('#foe').innerHTML = this.monImg(m);
    this.$('#foeName').textContent = m.name;
    const chip = this.$('#foeType');
    chip.textContent = t.name;
    chip.style.background = t.color;
    this.$('#stars').textContent = '★'.repeat(m.rarity) + '☆'.repeat(5 - m.rarity);
    this.$('#title').textContent = '野生的' + m.name;
    this.$('#arena').style.setProperty('--type', t.color);
    this.root.style.setProperty('--type', t.color);
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
        (c, i) => `<button class="pbtn ${c.on ? 'on' : ''}" data-i="${i}" style="--type:${c.color}" aria-label="夥伴 ${i + 1}">
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

  // ---- panel ----------------------------------------------------------------

  private setMode(mode: PanelMode): void {
    this.$('#panel').className = `panel ${mode === 'defend' ? 'defend' : ''}`;
    this.root.dataset.mode = mode;
  }

  showWord(opts: { mode: 'speak' | 'defend'; word: Word; hint: string; revenge?: boolean; showConfirm?: boolean; listening?: boolean; typing?: boolean; note?: string; timer?: boolean }): void {
    const { word, mode } = opts;
    this.setMode(mode);
    this.$('#hint').textContent = (opts.revenge ? '復仇！ ' : '') + opts.hint;
    const pic = word.icon ? `<div class="pic" data-act="hear">${word.icon}</div>` : `<div class="pic zh" data-act="hear">${esc(word.zh)}</div>`;
    const typing = opts.typing
      ? `<div class="typebox"><input id="typed" inputmode="latin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="輸入單字"><button class="small-btn ok" data-act="send" aria-label="送出">${CHECK}</button></div>`
      : '';
    const micBtn = opts.typing
      ? ''
      : `<button class="mic ${opts.listening ? 'live' : ''}" data-act="mic">${MIC}<span>${opts.listening ? '聽著…' : mode === 'defend' ? '念出防禦咒語' : '按下去，說說看'}</span></button>`;
    this.$('#body').innerHTML = `
      <div class="wordrow" data-act="hear">${pic}<div><div class="word" id="theWord">${esc(word.w)}</div><div class="zh">${esc(word.zh)}</div></div></div>
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

  showVictory(foe: Mon, words: Word[]): void {
    this.setMode('victory');
    this.$('#hint').textContent = '';
    this.$('#body').innerHTML = `<div class="victory">
      <div class="big">打倒了${esc(foe.name)}！</div>
      <div class="zh">學到的咒語</div>
      <div class="cards">${words.slice(0, 6).map((w) => `<span>${w.icon ?? ''} ${esc(w.w)}</span>`).join('') || '<span>—</span>'}</div>
      <button class="btn" data-act="next">再遇見一隻</button></div>`;
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

  /** The partner fires a type-coloured move at the wild creature. */
  shoot(colors: string[], style: string, done: () => void): void {
    const from = this.center(this.$('#me'));
    const to = this.center(this.$('#foe'));
    const c = colors[0] ?? '#ffc53d';
    const n = style === 'flame' || style === 'leaf' || style === 'swarm' || style === 'tornado' ? 3 : 1;
    let left = n;
    for (let i = 0; i < n; i++) {
      const orb = this.spawn('orb', from.x, from.y, colors[i % colors.length] ?? c);
      const dy = (i - (n - 1) / 2) * 34;
      const dur = style === 'bolt' || style === 'jet' ? 220 : 420;
      const anim = orb.animate(
        [{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${(to.x - from.x) * 0.5}px, ${(to.y - from.y) * 0.5 + dy - 24}px) scale(1.1)`, offset: 0.5 }, { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.9)` }],
        { duration: dur, delay: i * 60, easing: 'ease-in', fill: 'forwards' },
      );
      anim.onfinish = () => {
        orb.remove();
        if (--left === 0) {
          this.burst(to.x, to.y, c);
          done();
        }
      };
    }
  }

  burst(x: number, y: number, color: string): void {
    const r = this.spawn('ring', x, y, color);
    r.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(5)', opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => r.remove();
    for (let i = 0; i < 8; i++) {
      const p = this.spawn('orb', x, y, color);
      p.style.width = p.style.height = '10px';
      p.style.margin = '-5px';
      const a = (i / 8) * Math.PI * 2;
      p.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 50}px, ${Math.sin(a) * 50}px)`, opacity: 0 }], { duration: 500, easing: 'ease-out' }).onfinish = () => p.remove();
    }
  }

  /** The wild creature rushes at the partner. */
  foeAttack(colors: string[], done: () => void): void {
    const foe = this.$('#foe');
    foe.classList.add('lunge');
    window.setTimeout(() => foe.classList.remove('lunge'), 520);
    const from = this.center(foe);
    const to = this.center(this.$('#me'));
    const orb = this.spawn('orb', from.x, from.y, colors[0] ?? '#d9534f');
    const anim = orb.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px)` }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = () => {
      orb.remove();
      done();
    };
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
