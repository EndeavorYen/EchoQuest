/**
 * All sound is synthesised on the fly (square / triangle / noise), so there
 * are no audio files to download and everything has that 8-bit bleep.
 */

import { HOLD, SONGS, type SongName } from './songs';

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export type SfxName =
  | 'tap' | 'select' | 'back' | 'listen' | 'hit' | 'perfect' | 'good' | 'miss' | 'combo'
  | 'appear' | 'monsterAttack' | 'warn' | 'shield' | 'block' | 'hurt' | 'win' | 'chest'
  | 'step' | 'scan' | 'shutter' | 'heal' | 'boss' | 'rare' | 'catchSuck' | 'catchWobble' | 'catchLock' | 'crit' | 'evoPulse' | 'evolveDone' | 'starUp'
  | 'dodge' | 'reflect' | 'shieldBreak' | 'status' | 'lose';

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Music sits well under the effects so a spoken answer and its feedback are never drowned out. */
export const MASTER_GAIN = 0.32;
export const MUSIC_GAIN = 0.22;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  musicOn = true;
  private song: SongName | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  /** Must be called from a user gesture at least once (browser autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_GAIN;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // a tune asked for before the first tap starts now
    if (this.song && this.timer === null) {
      const s = this.song;
      this.song = null;
      this.setMusic(s);
    }
  }

  /** The page went to the background (or came back): silence everything meanwhile. */
  pause(hidden: boolean): void {
    if (!this.ctx) return;
    try {
      if (hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    } catch {
      // ignore
    }
  }

  private tone(freq: number, dur: number, wave: Wave, vol: number, when = 0, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, when = 0, lowpass = 3000, dest?: AudioNode): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName, arg = 0): void {
    if (!this.enabled || !this.ctx) return;
    const n = (m: number) => midiToHz(m);
    switch (name) {
      case 'tap': this.tone(n(84), 0.06, 'square', 0.25); break;
      case 'select':
        this.tone(n(76), 0.07, 'square', 0.25);
        this.tone(n(83), 0.1, 'square', 0.25, 0.06);
        break;
      case 'back': this.tone(n(79), 0.06, 'square', 0.22); this.tone(n(72), 0.09, 'square', 0.22, 0.05); break;
      case 'listen': this.tone(n(72), 0.08, 'triangle', 0.4); this.tone(n(79), 0.14, 'triangle', 0.4, 0.07); break;
      case 'scan': this.tone(n(60), 0.5, 'sawtooth', 0.12, 0, n(96)); break;
      case 'shutter': this.noise(0.12, 0.5, 0, 6000); this.tone(n(96), 0.05, 'square', 0.2); break;
      case 'appear':
        this.tone(n(48), 0.5, 'square', 0.28, 0, n(84));
        this.tone(n(55), 0.5, 'triangle', 0.3, 0.05, n(91));
        this.tone(n(88), 0.1, 'square', 0.2, 0.5);
        this.tone(n(91), 0.16, 'square', 0.2, 0.58);
        break;
      case 'boss':
        // arg 1 is the champion: lower, longer, with an extra rising sting
        this.tone(n(36), 0.9, 'sawtooth', 0.3, 0, n(30));
        this.tone(n(43), 0.9, 'square', 0.22, 0.1, n(38));
        this.noise(0.6, 0.32, 0, 600);
        [55, 58, 62, 67].forEach((m, i) => this.tone(n(m), 0.14, 'square', 0.26, 0.55 + i * 0.1));
        if (arg) {
          this.tone(n(31), 1.2, 'sawtooth', 0.28, 0.2, n(26));
          [67, 70, 74, 79, 82].forEach((m, i) => this.tone(n(m), 0.12, 'square', 0.24, 1.0 + i * 0.08));
        }
        break;
      case 'hit': {
        const base = 220 + arg * 90;
        this.noise(0.14, 0.55, 0, 4500);
        this.tone(base * 2, 0.16, 'square', 0.35, 0, base * 0.5);
        this.tone(base, 0.2, 'triangle', 0.4, 0.02, base * 0.4);
        break;
      }
      case 'perfect':
        [72, 76, 79, 84, 88].forEach((m, i) => this.tone(n(m), 0.11, 'square', 0.26, i * 0.055));
        break;
      case 'good':
        this.tone(n(72), 0.09, 'square', 0.24);
        this.tone(n(76), 0.13, 'square', 0.24, 0.07);
        break;
      case 'miss':
        this.tone(n(67), 0.14, 'triangle', 0.35, 0, n(60));
        this.tone(n(62), 0.2, 'triangle', 0.35, 0.12, n(52));
        break;
      case 'combo': {
        const m = 72 + Math.min(arg, 8) * 2;
        this.tone(n(m), 0.07, 'square', 0.25);
        this.tone(n(m + 7), 0.07, 'square', 0.25, 0.06);
        this.tone(n(m + 12), 0.13, 'square', 0.25, 0.12);
        break;
      }
      case 'monsterAttack':
        this.tone(n(55), 0.5, 'sawtooth', 0.28, 0, n(33));
        this.noise(0.4, 0.3, 0.1, 900);
        break;
      case 'warn': {
        // arg 0 ordinary, 1 rare (three beats), 2 legendary (four, lower and heavier)
        const beats = 2 + arg;
        const drop = arg === 2 ? 7 : 0;
        for (let i = 0; i < beats; i++) {
          this.tone(n(81 - drop), 0.09, 'square', 0.28, i * 0.16);
          this.tone(n(76 - drop), 0.09, 'square', 0.28, i * 0.16 + 0.08);
        }
        if (arg === 2) this.tone(n(40), 0.7, 'sawtooth', 0.22, 0, n(34));
        break;
      }
      case 'crit':
        // a hard word right: a heavy hit with a bright ring on top
        this.noise(0.25, 0.6, 0, 5000);
        this.tone(n(43), 0.35, 'sawtooth', 0.35, 0, n(31));
        [84, 91, 96, 103].forEach((m, i) => this.tone(n(m), 0.12, 'square', 0.22, 0.05 + i * 0.05));
        break;
      case 'evoPulse':
        // arg: which pulse; each one a little higher, the evolution winding up
        this.tone(n(64 + Math.min(arg, 14) * 2), 0.09, 'triangle', 0.26);
        break;
      case 'evolveDone':
        [72, 76, 79, 84].forEach((m, i) => this.tone(n(m), 0.16, 'square', 0.24, i * 0.1));
        [84, 88, 91].forEach((m) => this.tone(n(m), 0.9, 'triangle', 0.26, 0.42));
        this.tone(n(48), 0.9, 'triangle', 0.3, 0.42);
        this.noise(0.5, 0.18, 0.42, 9000);
        break;
      case 'starUp':
        // arg 0: the "ready to grow" chime; 1: the star itself
        [88, 93, 100].forEach((m, i) => this.tone(n(m), arg ? 0.3 : 0.14, 'triangle', 0.26, i * 0.07));
        if (arg) this.noise(0.35, 0.16, 0.2, 9000);
        break;
      case 'catchSuck':
        // sucked into the ball: a falling whoosh and a little pop
        this.tone(n(88), 0.5, 'triangle', 0.3, 0, n(52));
        this.noise(0.45, 0.22, 0, 2500);
        this.tone(n(96), 0.07, 'square', 0.22, 0.5);
        break;
      case 'catchWobble':
        // arg 0..2: each wobble a touch higher
        this.tone(n(52 + arg * 2), 0.14, 'square', 0.3, 0, n(46 + arg * 2));
        this.noise(0.06, 0.3, 0, 900);
        break;
      case 'catchLock':
        // arg: 0 ordinary, 1 rare, 2 legendary. A click, then a ding that gets bigger with the grade
        this.noise(0.05, 0.5, 0, 6000);
        this.tone(n(79), 0.5, 'triangle', 0.4, 0.04);
        this.tone(n(91), 0.5, 'triangle', 0.3, 0.04);
        if (arg >= 1) this.tone(n(98), 0.5, 'triangle', 0.26, 0.12);
        if (arg >= 2) [103, 107, 110, 115].forEach((m, i) => this.tone(n(m), 0.2, 'square', 0.2, 0.22 + i * 0.07));
        break;
      case 'rare': {
        // a rising sparkle; arg 1 (legendary) is longer, lower underneath and ends on a high chord
        const run = arg ? [72, 76, 79, 84, 88, 91, 96] : [72, 79, 84, 88, 91];
        run.forEach((m, i) => this.tone(n(m), 0.12, 'square', 0.22, i * 0.07));
        this.tone(n(48), 0.5, 'triangle', 0.3, 0, n(60));
        const at = run.length * 0.07;
        [84, 91, 96].forEach((m) => this.tone(n(m), arg ? 0.7 : 0.4, 'triangle', 0.26, at));
        if (arg) this.noise(0.5, 0.2, at, 8000);
        break;
      }
      case 'shield':
        [79, 84, 91].forEach((m, i) => this.tone(n(m), 0.14, 'triangle', 0.38, i * 0.05));
        break;
      case 'block':
        this.noise(0.1, 0.5, 0, 7000);
        this.tone(n(96), 0.3, 'triangle', 0.4, 0, n(88));
        this.tone(n(84), 0.4, 'square', 0.18, 0.04, n(79));
        break;
      case 'hurt':
        this.noise(0.25, 0.5, 0, 1200);
        this.tone(n(48), 0.3, 'square', 0.3, 0, n(36));
        break;
      case 'heal':
        [72, 76, 79, 84].forEach((m, i) => this.tone(n(m), 0.1, 'triangle', 0.3, i * 0.07));
        break;
      case 'win':
        [72, 72, 72, 76, 79, 79, 76, 79, 84].forEach((m, i) => this.tone(n(m), 0.14, 'square', 0.26, i * 0.1));
        [48, 55, 60].forEach((m, i) => this.tone(n(m), 0.5, 'triangle', 0.3, i * 0.3));
        break;
      case 'chest':
        for (let i = 0; i < 7; i++) this.tone(n(84 + (i % 4) * 3), 0.1, 'square', 0.2, i * 0.06);
        break;
      case 'step': this.tone(n(64 + (arg % 4) * 2), 0.06, 'square', 0.2); break;
      case 'dodge':
        this.noise(0.22, 0.35, 0, 2500);
        this.tone(n(72), 0.22, 'triangle', 0.3, 0, n(91));
        break;
      case 'reflect':
        this.tone(n(96), 0.07, 'square', 0.3);
        this.tone(n(84), 0.07, 'square', 0.3, 0.07);
        this.tone(n(91), 0.07, 'square', 0.3, 0.14);
        this.tone(n(100), 0.2, 'triangle', 0.35, 0.21, n(88));
        break;
      case 'shieldBreak': {
        // arg 0: a crack; arg 1: the whole layer shatters
        this.noise(arg ? 0.35 : 0.14, arg ? 0.55 : 0.4, 0, 8000);
        this.tone(n(arg ? 96 : 88), arg ? 0.3 : 0.12, 'square', 0.3, 0, n(arg ? 60 : 76));
        if (arg) [91, 84, 79, 72].forEach((m, i) => this.tone(n(m), 0.1, 'triangle', 0.3, 0.05 + i * 0.05));
        break;
      }
      case 'status': {
        // each condition has its own colour of sound; arg picks it
        const base = 60 + (arg % 7) * 2;
        this.tone(n(base + 12), 0.12, 'square', 0.22, 0, n(base + 5));
        this.tone(n(base + 7), 0.12, 'triangle', 0.3, 0.1, n(base));
        this.tone(n(base + 12), 0.2, 'triangle', 0.3, 0.2, n(base + 3));
        break;
      }
      case 'lose':
        [67, 64, 60, 55].forEach((m, i) => this.tone(n(m), 0.28, 'triangle', 0.34, i * 0.22, n(m - 2)));
        this.tone(n(43), 0.9, 'square', 0.14, 0.5, n(38));
        break;
    }
  }

  /** The sound of a spell, by the look of its move (flame, bubble, bolt…). */
  cast(style: string): void {
    if (!this.enabled || !this.ctx) return;
    const n = midiToHz;
    switch (style) {
      case 'flame':
        this.noise(0.45, 0.4, 0, 1800);
        this.tone(n(55), 0.4, 'sawtooth', 0.2, 0, n(79));
        break;
      case 'bubble': case 'wave': case 'jet':
        [72, 76, 79, 84].forEach((m, i) => this.tone(n(m), 0.09, 'sine', 0.38, i * 0.06, n(m + 5)));
        if (style !== 'bubble') this.noise(0.35, 0.22, 0.05, 1400);
        break;
      case 'bolt':
        [96, 84, 98, 82, 100].forEach((m, i) => this.tone(n(m), 0.045, 'square', 0.26, i * 0.04));
        this.noise(0.1, 0.3, 0.18, 7000);
        break;
      case 'ice':
        [100, 96, 103, 98, 107].forEach((m, i) => this.tone(n(m), 0.14, 'triangle', 0.3, i * 0.05));
        break;
      case 'leaf': case 'swarm':
        for (let i = 0; i < 6; i++) this.tone(n(79 + (i % 3) * 4), 0.05, 'square', 0.16, i * 0.045);
        this.noise(0.25, 0.14, 0, 3500);
        break;
      case 'boulder': case 'fist':
        this.tone(n(40), 0.25, 'square', 0.34, 0, n(30));
        this.noise(0.18, 0.4, 0, 700);
        break;
      case 'tornado':
        this.tone(n(52), 0.55, 'sawtooth', 0.18, 0, n(80));
        this.tone(n(80), 0.3, 'sawtooth', 0.14, 0.4, n(55));
        this.noise(0.6, 0.18, 0, 2000);
        break;
      case 'crescent': case 'wisp':
        this.tone(n(79), 0.5, 'triangle', 0.3, 0, n(60));
        this.tone(n(67), 0.5, 'triangle', 0.22, 0.12, n(48));
        break;
      case 'ricochet':
        [93, 88, 93, 86, 93].forEach((m, i) => this.tone(n(m), 0.05, 'square', 0.24, i * 0.07));
        break;
      default: // star, charm, twin and anything new
        [84, 88, 91, 96].forEach((m, i) => this.tone(n(m), 0.1, 'triangle', 0.3, i * 0.06));
    }
  }

  // ---- music ----
  setMusic(which: SongName | null): void {
    if (this.song === which) return;
    this.song = which;
    this.step = 0;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (!which || !this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  /** The tune that is playing (or should be, once the browser lets audio start). */
  get playing(): SongName | null {
    return this.song;
  }

  private schedule(): void {
    if (!this.ctx || !this.song || !this.musicGain) return;
    const song = SONGS[this.song] as import('./songs').Song;
    const eighth = 60 / song.bpm / 2;
    const len = song.lead.length;
    // how many steps a note lasts: itself plus the holds that follow it
    const span = (line: Array<number | null>, i: number): number => {
      let k = 1;
      while (line[(i + k) % len] === HOLD && k < len) k++;
      return k;
    };
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const i = this.step % len;
      const when = Math.max(0, this.nextTime - this.ctx.currentTime);
      if (this.enabled && this.musicOn) {
        const l = song.lead[i];
        const b = song.bass[i];
        if (l !== null && l !== HOLD) this.tone(midiToHz(l), eighth * span(song.lead, i) * 0.92, 'square', 0.16, when, undefined, this.musicGain);
        if (b !== null && b !== HOLD) this.tone(midiToHz(b), eighth * Math.max(1.6, span(song.bass, i) * 0.95), 'triangle', 0.3, when, undefined, this.musicGain);
        const d = song.drums?.[i];
        if (d === 'k') this.tone(130, 0.11, 'triangle', 0.5, when, 45, this.musicGain);
        else if (d === 's') this.noise(0.1, 0.35, when, 5000, this.musicGain);
        else if (d === 'h') this.noise(0.035, 0.12, when, 9000, this.musicGain);
      }
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  /** Re-sync when the music toggle flips. */
  refreshMusic(): void {
    const s = this.song;
    this.song = null;
    this.setMusic(s);
  }
}

export const sfx = new Sfx();

// ---- text to speech ----------------------------------------------------

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => /en[-_]US/i.test(v.lang) && /samantha|google us|aria|jenny|female/i.test(v.name)) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function say(text: string, rate = 0.8): void {
  if (typeof speechSynthesis === 'undefined' || !sfx.enabled) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch {
    // speech is a nicety; never break the game over it
  }
}

let zhVoice: SpeechSynthesisVoice | null = null;

function pickZhVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  zhVoice =
    voices.find((v) => /zh[-_]TW/i.test(v.lang)) ??
    voices.find((v) => /cmn[-_]Hant|zh[-_]HK/i.test(v.lang)) ??
    voices.find((v) => /^zh/i.test(v.lang)) ??
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  pickZhVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickZhVoice);
}

/**
 * Say a word the way a learner needs to hear it: English first (slow), then the Chinese
 * meaning, so even a word with no picture teaches both how it sounds and what it means.
 */
export function sayWord(en: string, zh: string, rate = 0.7): void {
  if (typeof speechSynthesis === 'undefined' || !sfx.enabled) return;
  try {
    speechSynthesis.cancel();
    const a = new SpeechSynthesisUtterance(en);
    a.lang = 'en-US';
    if (voice) a.voice = voice;
    a.rate = rate;
    a.pitch = 1.1;
    speechSynthesis.speak(a);
    if (zh) {
      const b = new SpeechSynthesisUtterance(zh);
      b.lang = 'zh-TW';
      if (zhVoice) b.voice = zhVoice;
      b.rate = 0.9;
      speechSynthesis.speak(b);
    }
  } catch {
    // speech is a nicety; never break the game over it
  }
}

export function stopSay(): void {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
