/**
 * All sound is synthesised on the fly (square / triangle / noise), so there
 * are no audio files to download and everything has that 8-bit bleep.
 */

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export type SfxName =
  | 'tap' | 'select' | 'back' | 'listen' | 'hit' | 'perfect' | 'good' | 'miss' | 'combo'
  | 'appear' | 'monsterAttack' | 'warn' | 'shield' | 'block' | 'hurt' | 'win' | 'chest'
  | 'step' | 'scan' | 'shutter' | 'heal' | 'boss';

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

type Song = { bpm: number; lead: Array<number | null>; bass: Array<number | null> };

// 32 eighth-note steps each. null = rest. Numbers are MIDI notes.
const SONGS: Record<'map' | 'battle', Song> = {
  map: {
    bpm: 104,
    lead: [
      72, null, 76, null, 79, null, 76, null, 81, null, 79, null, 76, 74, null, null,
      72, null, 76, null, 79, null, 84, null, 83, null, 79, null, 76, 74, 72, null,
    ],
    bass: [
      48, null, 55, null, 48, null, 55, null, 45, null, 52, null, 45, null, 52, null,
      41, null, 48, null, 41, null, 48, null, 43, null, 50, null, 43, null, 50, null,
    ],
  },
  battle: {
    bpm: 148,
    lead: [
      69, 72, 76, 72, 69, 72, 76, 72, 67, 71, 74, 71, 67, 71, 74, 71,
      65, 69, 72, 69, 65, 69, 72, 69, 64, 68, 71, 68, 64, 68, 71, 76,
    ],
    bass: [
      45, 45, null, 45, 45, null, 45, 45, 43, 43, null, 43, 43, null, 43, 43,
      41, 41, null, 41, 41, null, 41, 41, 40, 40, null, 40, 40, null, 40, 52,
    ],
  },
};

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  musicOn = true;
  private song: 'map' | 'battle' | null = null;
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
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
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

  private noise(dur: number, vol: number, when = 0, lowpass = 3000): void {
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
    g.connect(this.master);
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
        this.tone(n(36), 0.9, 'sawtooth', 0.25, 0, n(30));
        this.tone(n(43), 0.9, 'square', 0.18, 0.1, n(38));
        this.noise(0.6, 0.25, 0, 600);
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
      case 'warn':
        for (let i = 0; i < 2; i++) {
          this.tone(n(81), 0.09, 'square', 0.28, i * 0.16);
          this.tone(n(76), 0.09, 'square', 0.28, i * 0.16 + 0.08);
        }
        break;
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
    }
  }

  // ---- music ----
  setMusic(which: 'map' | 'battle' | null): void {
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

  private schedule(): void {
    if (!this.ctx || !this.song || !this.musicGain) return;
    const song = SONGS[this.song];
    const eighth = 60 / song.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const i = this.step % song.lead.length;
      const when = Math.max(0, this.nextTime - this.ctx.currentTime);
      if (this.enabled && this.musicOn) {
        const l = song.lead[i];
        const b = song.bass[i];
        if (l !== null) this.tone(midiToHz(l), eighth * 0.9, 'square', 0.16, when, undefined, this.musicGain);
        if (b !== null) this.tone(midiToHz(b), eighth * 1.6, 'triangle', 0.3, when, undefined, this.musicGain);
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
