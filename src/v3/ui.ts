/** Small shared pieces of the look, so every screen draws them the same way. */

/** Dark ink or white, whichever reads better on this background colour (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // contrast against white vs against the ink colour (#1f2a44, L ≈ 0.024)
  const white = 1.05 / (L + 0.05);
  const ink = (L + 0.05) / (0.024 + 0.05);
  return ink > white ? '#1f2a44' : '#fff';
}

/** A type chip with readable text on its colour. */
export function typeChip(t: { name: string; color: string }, id = ''): string {
  return `<span class="chip"${id ? ` id="${id}"` : ''} style="background:${t.color};color:${inkOn(t.color)}">${t.name}</span>`;
}

/** Rarity as filled stars, with the empty ones dimmed so 1★ and 5★ look different at a glance. */
export function starsHtml(rarity: number): string {
  const r = Math.max(0, Math.min(5, rarity));
  return `${'★'.repeat(r)}${r < 5 ? `<span class="off">${'☆'.repeat(5 - r)}</span>` : ''}`;
}
