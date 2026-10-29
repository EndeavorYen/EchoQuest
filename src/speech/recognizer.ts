export type ListenStatus = 'idle' | 'starting' | 'listening';

export type ListenOutcome =
  | { ok: true; candidates: string[] }
  | { ok: false; reason: 'no-speech' | 'denied' | 'unsupported' | 'error' | 'aborted' };

interface RecAlt { transcript: string }
interface RecResult { isFinal: boolean; length: number; [i: number]: RecAlt }
interface RecEvent { results: ArrayLike<RecResult>; resultIndex: number }
interface Rec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Chrome's on-device contextual biasing (newer versions only) */
  phrases?: unknown[];
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecCtor = new () => Rec;

function ctor(): RecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Ask the engine to favour the words we are listening for. Ignored where unsupported. */
function bias(rec: Rec, hints: string[]): void {
  try {
    const w = window as unknown as { SpeechRecognitionPhrase?: new (phrase: string, boost?: number) => unknown };
    if (hints.length && w.SpeechRecognitionPhrase && 'phrases' in rec) {
      rec.phrases = hints.map((h) => new w.SpeechRecognitionPhrase!(h, 8));
    }
  } catch {
    // biasing is only a nudge
  }
}

export const speechSupported = (): boolean => ctor() !== null;

/**
 * One-shot listener: tap, say a word, get the engine's alternatives back.
 * `listen()` has to be called straight from a tap handler — iOS Safari only
 * allows the microphone to start from a user gesture.
 */
export class Recognizer {
  status: ListenStatus = 'idle';
  /** live partial transcript while the player is speaking */
  interim = '';
  private rec: Rec | null = null;
  private done: ((o: ListenOutcome) => void) | null = null;
  private timer: number | null = null;
  private gotResult = false;

  get supported(): boolean {
    return speechSupported();
  }

  /**
   * @param hints words we expect to hear; engines that support contextual biasing lean towards them
   */
  listen(done: (o: ListenOutcome) => void, hints: string[] = [], lang = 'en-US'): void {
    const C = ctor();
    if (!C) {
      done({ ok: false, reason: 'unsupported' });
      return;
    }
    this.cancel();
    this.interim = '';
    this.gotResult = false;
    this.done = done;
    this.status = 'starting';

    let rec: Rec;
    try {
      rec = new C();
    } catch {
      this.finish({ ok: false, reason: 'error' });
      return;
    }
    this.rec = rec;
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 10;
    bias(rec, hints);
    rec.onstart = () => { if (this.rec === rec) this.status = 'listening'; };
    rec.onaudiostart = () => { if (this.rec === rec) this.status = 'listening'; };
    rec.onresult = (e) => {
      if (this.rec !== rec) return;
      const last = e.results[e.results.length - 1];
      if (!last) return;
      const alts: string[] = [];
      for (let i = 0; i < last.length; i++) alts.push(last[i].transcript);
      this.interim = alts[0] ?? '';
      if (last.isFinal) {
        this.gotResult = true;
        this.finish({ ok: true, candidates: alts.filter(Boolean) });
      }
    };
    rec.onerror = (e) => {
      if (this.rec !== rec) return;
      const err = e.error ?? '';
      if (err === 'not-allowed' || err === 'service-not-allowed') this.finish({ ok: false, reason: 'denied' });
      else if (err === 'no-speech') this.finish({ ok: false, reason: 'no-speech' });
      else if (err === 'aborted') this.finish({ ok: false, reason: 'aborted' });
      else this.finish({ ok: false, reason: 'error' });
    };
    rec.onend = () => {
      if (this.rec !== rec || this.gotResult) return;
      // the engine closed without a final result: use what we heard, if anything
      if (this.interim) this.finish({ ok: true, candidates: [this.interim] });
      else this.finish({ ok: false, reason: 'no-speech' });
    };
    try {
      rec.start();
    } catch {
      this.finish({ ok: false, reason: 'error' });
      return;
    }
    this.timer = window.setTimeout(() => {
      try { rec.stop(); } catch { /* already stopped */ }
    }, 7000);
  }

  private finish(o: ListenOutcome): void {
    const cb = this.done;
    this.clear();
    cb?.(o);
  }

  private clear(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const rec = this.rec;
    this.rec = null;
    this.done = null;
    this.status = 'idle';
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onstart = rec.onaudiostart = null;
      try { rec.abort(); } catch { /* ignore */ }
    }
  }

  /** Stop without reporting a result. */
  cancel(): void {
    this.clear();
  }
}
