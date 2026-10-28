import type { App } from '../core/app';
import type { Speaker } from '../speech/speaker';
import { C } from '../gfx/palette';
import { ICON } from '../gfx/icons';
import { BTN } from '../gfx/ui';
import { drawText } from '../gfx/text';

/** The round microphone button, with a pulsing ring while it is listening. */
export function micButton(app: App, cx: number, cy: number, speaker: Speaker, onTap: () => void, r = 15, shield = false): void {
  const fb = app.fb;
  const listening = speaker.listening;
  const pressed = app.ui.isPressed(cx - r, cy - r, r * 2, r * 2);
  if (listening) {
    const k = (app.t * 1.6) % 1;
    fb.ring(cx, cy, Math.round(r + 2 + k * 9), k < 0.5 ? C.sun : C.orange);
    fb.ring(cx, cy, Math.round(r + 2 + ((k + 0.5) % 1) * 9), C.orange);
  }
  const base = listening ? C.berry : shield ? C.royal : C.orange;
  const hi = listening ? C.orange : shield ? C.sky : C.sun;
  const lo = listening ? C.plum : shield ? C.navy : C.berry;
  const oy = pressed ? 1 : 0;
  fb.disc(cx, cy + 1, r + 1, C.ink);
  fb.disc(cx, cy + 1, r, lo);
  fb.disc(cx, cy + oy, r - 1, base);
  if (!pressed) fb.ring(cx, cy, r - 1, hi);
  const icon = shield ? ICON.shield : ICON.mic;
  fb.blit(icon, cx - Math.floor(icon.w / 2), cy - Math.floor(icon.h / 2) + oy);
  app.ui.zone(cx - r - 4, cy - r - 4, (r + 4) * 2, (r + 4) * 2, onTap, 'mic');
}

export function statusLine(app: App, speaker: Speaker, y: number, idle: string): void {
  const fb = app.fb;
  let text = idle;
  let color: number = C.mist;
  if (speaker.listening) {
    if (speaker.interim) {
      text = `“${speaker.interim}”`;
      color = C.ice;
    } else {
      text = speaker.starting ? '…' : 'Listening!';
      color = C.sun;
    }
  }
  drawText(fb, text, app.W / 2, y, color, { align: 'center' });
}

/** Typing fallback: text box with a blinking caret and a GO button. */
export function typingBox(app: App, speaker: Speaker, y: number, onSubmit: () => void): void {
  const fb = app.fb;
  const w = 140;
  const x = Math.round((app.W - w) / 2);
  fb.rect(x - 1, y - 1, w + 2, 18, C.ink);
  fb.rect(x, y, w, 16, C.snow);
  const caret = Math.floor(app.t * 2) % 2 === 0 ? '_' : '';
  drawText(fb, speaker.typed + caret, x + 4, y + 1, C.ink);
  app.ui.button(fb, x + 30, y + 22, 80, 18, 'GO!', BTN.green, onSubmit);
  // tapping the box brings the keyboard back if it was dismissed
  app.ui.zone(x, y, w, 16, () => (document.getElementById('textfield') as HTMLInputElement | null)?.focus());
}

export function failMessage(reason: string): string {
  switch (reason) {
    case 'denied': return 'Mic is blocked.\nAllow the microphone,\nor tap the keyboard.';
    case 'unsupported': return 'No voice here.\nTap the keyboard to type.';
    case 'no-speech': return "I didn't hear you.\nTap the mic and try again!";
    default: return 'Oops! Try again.';
  }
}
