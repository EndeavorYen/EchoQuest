import type { FB, Sprite } from './fb';
import { C, type PalIndex } from './palette';
import { drawText, measure } from './text';
import { fromRows } from './icons';

export interface BtnStyle {
  face: PalIndex;
  light: PalIndex;
  dark: PalIndex;
  text: PalIndex;
}

export const BTN = {
  primary: { face: C.orange, light: C.sun, dark: C.berry, text: C.snow },
  green: { face: C.leaf, light: C.lime, dark: C.teal, text: C.snow },
  blue: { face: C.royal, light: C.sky, dark: C.navy, text: C.snow },
  gray: { face: C.slate, light: C.mist, dark: C.dusk, text: C.snow },
  danger: { face: C.berry, light: C.orange, dark: C.plum, text: C.snow },
  gold: { face: C.sun, light: C.snow, dark: C.orange, text: C.ink },
  dark: { face: C.dusk, light: C.slate, dark: C.ink, text: C.mist },
} satisfies Record<string, BtnStyle>;

interface Hit {
  x: number; y: number; w: number; h: number; cb: () => void; label?: string;
}

export interface ButtonOpts {
  disabled?: boolean;
  /** draw this sprite instead of a text label */
  icon?: Sprite;
  /** extra pixel offset for the label (e.g. a bounce) */
  dy?: number;
  textScale?: number;
  /** test-facing name for icon-only buttons */
  name?: string;
}

/**
 * Immediate-mode UI. Scenes draw their buttons every frame; each call also
 * registers a hit zone. Taps are dispatched synchronously from the pointer
 * event itself, which matters: iOS only lets the microphone start from inside
 * a real user gesture.
 */
export class UI {
  private hits: Hit[] = [];
  px = -100;
  py = -100;
  down = false;

  begin(): void {
    this.hits = [];
  }

  /** `label` only names the zone for automated tests (see `list`). */
  zone(x: number, y: number, w: number, h: number, cb: () => void, label?: string): void {
    this.hits.push({ x, y, w, h, cb, label });
  }

  /** The tappable zones drawn in the last frame (used by the end-to-end tests). */
  list(): Array<{ x: number; y: number; w: number; h: number; label?: string }> {
    return this.hits.map(({ x, y, w, h, label }) => ({ x, y, w, h, label }));
  }

  /** Invoke the top-most zone under the point. Returns whether anything was hit. */
  dispatch(x: number, y: number): boolean {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) {
        h.cb();
        return true;
      }
    }
    return false;
  }

  isPressed(x: number, y: number, w: number, h: number): boolean {
    return this.down && this.px >= x && this.py >= y && this.px < x + w && this.py < y + h;
  }

  button(fb: FB, x: number, y: number, w: number, h: number, label: string, style: BtnStyle, cb: () => void, o: ButtonOpts = {}): void {
    const pressed = !o.disabled && this.isPressed(x, y, w, h);
    const st: BtnStyle = o.disabled ? BTN.dark : style;
    const oy = pressed ? 1 : 0;
    // body: ink outline, dark base, face, light top edge
    fb.rect(x, y + 1, w, h - 1, C.ink);
    fb.rect(x + 1, y + 2 - oy * 0, w - 2, h - 3, st.dark);
    fb.rect(x + 1, y + 1 + oy, w - 2, h - 3 - (pressed ? 0 : 0), st.face);
    if (!pressed) fb.rect(x + 1, y + 1, w - 2, 1, st.light);
    fb.rect(x, y + 1, 1, 1, C.ink);
    fb.rect(x + w - 1, y + 1, 1, 1, C.ink);
    fb.rect(x + 1, y, w - 2, 1, C.ink);
    // label
    const dy = (o.dy ?? 0) + oy;
    if (o.icon) {
      fb.blit(o.icon, x + Math.round((w - o.icon.w) / 2), y + Math.round((h - o.icon.h) / 2) + dy);
    } else if (label) {
      let sc = o.textScale ?? 1;
      let tw = measure(label, sc);
      // smooth text is wider than the old bitmap font: shrink long labels to fit the button
      if (tw > w - 4) {
        sc = (sc * (w - 4)) / tw;
        tw = measure(label, sc);
      }
      const ty = y + Math.round((h - 14 * sc) / 2) + dy;
      drawText(fb, label, x + Math.round((w - tw) / 2), ty, o.disabled ? C.slate : st.text, { scale: sc, shadow: o.disabled ? undefined : st.dark });
    }
    if (!o.disabled) this.zone(x, y, w, h, cb, o.name ?? label);
  }
}

/** A framed window with a bevelled pixel border. */
export function panel(fb: FB, x: number, y: number, w: number, h: number, fill: PalIndex = C.dusk, border: PalIndex = C.slate): void {
  fb.rect(x + 1, y, w - 2, h, C.ink);
  fb.rect(x, y + 1, w, h - 2, C.ink);
  fb.rect(x + 1, y + 1, w - 2, h - 2, border);
  fb.rect(x + 2, y + 2, w - 4, h - 4, fill);
  fb.rect(x + 2, y + 2, w - 4, 1, C.mist === border ? C.snow : lighten(border));
}

function lighten(c: PalIndex): PalIndex {
  const map: Record<number, number> = { [C.slate]: C.mist, [C.dusk]: C.slate, [C.sun]: C.snow, [C.orange]: C.sun, [C.royal]: C.sky };
  return map[c] ?? c;
}

export function bar(fb: FB, x: number, y: number, w: number, h: number, frac: number, color: PalIndex, back: PalIndex = C.dusk, light?: PalIndex): void {
  fb.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
  fb.rect(x, y, w, h, back);
  const f = Math.max(0, Math.min(1, frac));
  const fw = Math.round(w * f);
  if (fw > 0) {
    fb.rect(x, y, fw, h, color);
    if (light !== undefined && h >= 3) fb.rect(x, y, fw, 1, light);
  }
}

// ---- avatars -------------------------------------------------------------

const AVATAR_TEMPLATES = [
  [
    '..kkkkkkkk..',
    '.kHHHHHHHHk.',
    'kHHHHHHHHHHk',
    'kHHSSSSSSHHk',
    'kHSSkSSkSSHk',
    'kHSSkSSkSSHk',
    '.kSqSSSSqSk.',
    '..kSSkkSSk..',
    '...kSSSSk...',
    '....kkkk....',
  ],
  [
    '...kkkkkk...',
    '..kAAAAAAk..',
    '.kAAAAAAAAk.',
    'kkkkkkkkkkkk',
    '.kSSSSSSSSk.',
    '.kSkSSSSkSk.',
    '.kSkSSSSkSk.',
    '.kSqSSSSqSk.',
    '..kSSkkSSk..',
    '...kkkkkk...',
  ],
  [
    '.kk......kk.',
    'kAAk....kAAk',
    'kAAkkkkkkAAk',
    '.kHHHHHHHHk.',
    '.kHSSSSSSHk.',
    '.kSSkSSkSSk.',
    '.kSSkSSkSSk.',
    '.kSqSSSSqSk.',
    '..kSSkkSSk..',
    '...kkkkkk...',
  ],
];

const AVATAR_COLORS: Array<{ H: string; A: string; S: string }> = [
  { H: 'p', A: 'r', S: 'y' },
  { H: 'G', A: 'g', S: 'y' },
  { H: 'n', A: 'b', S: 'y' },
  { H: 'r', A: 'o', S: 'y' },
  { H: 'd', A: 'i', S: 'y' },
  { H: 'o', A: 'y', S: 'y' },
];

const avatarCache = new Map<number, Sprite>();

export const AVATAR_COUNT = 6;

/** A bright colour per avatar so little kids can tell players apart without reading. */
const FACE_TINT: PalIndex[] = [C.orange, C.lime, C.sky, C.berry, C.sun, C.ice];
export function faceTint(face: number): PalIndex {
  return FACE_TINT[((face % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT];
}

export function avatarSprite(face: number): Sprite {
  const f = ((face % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  let s = avatarCache.get(f);
  if (s) return s;
  const tpl = AVATAR_TEMPLATES[f % AVATAR_TEMPLATES.length];
  const col = AVATAR_COLORS[f];
  s = fromRows(
    tpl.map((row) => row.replace(/H/g, col.H).replace(/A/g, col.A).replace(/S/g, col.S).replace(/q/g, 'o')),
  );
  avatarCache.set(f, s);
  return s;
}
