import type { Recognizer, ListenOutcome } from './recognizer';

export type SpeakResult =
  | { kind: 'heard'; candidates: string[] }
  | { kind: 'fail'; reason: 'no-speech' | 'denied' | 'unsupported' | 'error' | 'aborted' }
  | { kind: 'typed'; text: string };

/**
 * One answer attempt: either the player speaks (microphone) or types
 * (fallback for browsers without speech recognition, or a noisy room).
 */
export class Speaker {
  /** 'idle' | 'listening' | 'typing' */
  mode: 'idle' | 'listening' | 'typing' = 'idle';
  typed = '';
  private cb: ((r: SpeakResult) => void) | null = null;
  private input: HTMLInputElement | null;
  private onInput = () => {
    this.typed = (this.input?.value ?? '').slice(0, 24);
  };

  constructor(private rec: Recognizer) {
    this.input = document.getElementById('textfield') as HTMLInputElement | null;
  }

  get supported(): boolean {
    return this.rec.supported;
  }

  get interim(): string {
    return this.rec.interim;
  }

  /** True while the microphone is open (or about to open). */
  get listening(): boolean {
    return this.mode === 'listening';
  }

  get starting(): boolean {
    return this.mode === 'listening' && this.rec.status === 'starting';
  }

  /** Start the mic. Must be called straight from a tap handler. */
  listen(cb: (r: SpeakResult) => void, hints: string[] = []): void {
    this.cancel();
    this.cb = cb;
    this.mode = 'listening';
    this.rec.listen((o: ListenOutcome) => {
      if (this.mode !== 'listening') return;
      this.mode = 'idle';
      const done = this.cb;
      this.cb = null;
      if (o.ok) done?.({ kind: 'heard', candidates: o.candidates });
      else done?.({ kind: 'fail', reason: o.reason });
    }, hints);
  }

  /** Show the on-screen text box and raise the keyboard. Call from a tap handler. */
  openTyping(cb: (r: SpeakResult) => void): void {
    this.cancel();
    this.cb = cb;
    this.mode = 'typing';
    this.typed = '';
    if (this.input) {
      this.input.value = '';
      this.input.addEventListener('input', this.onInput);
      this.input.focus();
    }
  }

  submitTyping(): void {
    if (this.mode !== 'typing') return;
    const text = this.typed.trim();
    if (!text) return;
    const done = this.cb;
    this.cancel();
    done?.({ kind: 'typed', text });
  }

  cancel(): void {
    this.rec.cancel();
    if (this.input) {
      this.input.removeEventListener('input', this.onInput);
      this.input.blur();
      this.input.value = '';
    }
    this.mode = 'idle';
    this.typed = '';
    this.cb = null;
  }
}
