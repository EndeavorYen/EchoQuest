import type { Word } from './bank';

/** FNV-1a, 8 hex chars: enough to notice that a word's content changed. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Everything about a word that a change history should notice. Lists are left out on purpose. */
export function fingerprint(w: Word): string {
  return fnv([w.w, w.zh, w.lv, w.topic ?? '', w.icon ?? '', (w.heard ?? []).join(','), w.retired ? 'R' : '', w.replacedBy ?? ''].join('|'));
}

export interface Snapshot {
  rev: number;
  words: Record<string, string>;
}
