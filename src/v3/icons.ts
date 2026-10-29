/**
 * The game's own little icons: one outline weight, a few flat colours. The data still
 * carries emoji (places, relics, conditions); `glyph()` swaps the ones we have drawn for
 * these, so the screens look the same on every phone instead of following the system's emoji.
 */
const INK = '#1f2a44';

const ICONS = {
  // places
  pin: '<path d="M12 21.5s-6.5-6-6.5-11.2a6.5 6.5 0 0113 0c0 5.2-6.5 11.2-6.5 11.2z" fill="#ff6b57"/><circle cx="12" cy="10" r="2.4" fill="#fff"/>',
  house: '<path d="M4.5 11.5V20h15v-8.5" fill="#ffe0a8"/><path d="M2.8 12L12 4.2 21.2 12z" fill="#ff8a5c"/><path d="M10 20v-5h4v5" fill="#fff"/>',
  city: '<path d="M3 20.5V10l9-5.5 9 5.5v10.5z" fill="#cfd9ff"/><path d="M7.5 20.5v-6M12 20.5v-6M16.5 20.5v-6"/><circle cx="12" cy="9.5" r="1.6" fill="#ffcf3a"/>',
  cave: '<path d="M2 20.5L9 6.5l4 6.5 3-4.5 6 12z" fill="#b8aeb9"/><path d="M8.5 20.5v-3.5a3.5 3.5 0 017 0v3.5z" fill="#3b3550"/>',
  mountain: '<path d="M2 20.5L9.5 6l4 7 2.5-3.5 6 11z" fill="#b8aeb9"/><path d="M7 10.5l2.5 2 2.5-2" fill="#fff"/>',
  forest: '<path d="M12 3l5.5 7h-3L18 15.5H6L9.5 10h-3z" fill="#5dbb63"/><path d="M12 15.5V21"/>',
  lake: '<circle cx="12" cy="12" r="9" fill="#8ccbff"/><path d="M6.5 11c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0M7.5 15c1.2-1.1 2.4-1.1 3.6 0s2.4 1.1 3.6 0"/>',
  league: '<path d="M7 4h10v5a5 5 0 01-10 0z" fill="#ffcf3a"/><path d="M7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M12 14v4M8.5 20.5h7M9.5 18h5"/>',
  road: '<path d="M8 21L10 3M16 21L14 3"/><path d="M12 5v2.5M12 11v2.5M12 17v2.5"/>',
  wave: '<path d="M2.5 9c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0M2.5 15c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0"/>',
  meadow: '<path d="M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 2 3 5zM12 8c2-1 3-3 3-5-2 0-3 2-3 5zM12 15c-2-1-3-2.5-3-4.5M12 15c2-1 3-2.5 3-4.5"/>',
  // special places
  plant: '<path d="M3.5 20.5V11l5 3v-3l5 3V7h4v13.5z" fill="#c9d6ff"/><path d="M17 3v2.5"/><path d="M12 15l-1.6 2.6h3L12 20.5" stroke="#e0a400"/>',
  tower: '<path d="M12 2.5l5 18H7z" fill="#ff8a5c"/><path d="M9 11h6M8 16h8"/>',
  wheel: '<circle cx="12" cy="11" r="8" fill="#fff"/><circle cx="12" cy="11" r="1.6" fill="#ffcf3a"/><path d="M12 3v16M4 11h16M6.3 5.3l11.4 11.4M17.7 5.3L6.3 16.7M7 21.5l5-10.5 5 10.5"/>',
  fist: '<path d="M6 11V8a2 2 0 014 0V7a2 2 0 014 0v1a2 2 0 014 0v6a6 6 0 01-6 6h-2a6 6 0 01-6-6z" fill="#ffd9a0"/><path d="M10 11v2M14 10v3"/>',
  volcano: '<path d="M2.5 21L9 10h6l6.5 11z" fill="#b8aeb9"/><path d="M9 10l1.5 2 1.5-2 1.5 2 1.5-2" fill="#ff6b57"/><path d="M12 7V3.5M8.8 7.5L7.5 4.5M15.2 7.5l1.3-3" stroke="#ff6b57"/>',
  snowhut: '<path d="M2 20.5L9.5 6l4 7 2.5-3.5 6 11z" fill="#dfeaf5"/><path d="M7 10.5l2.5 2 2.5-2M13.5 13l2.5 1.5"/>',
  dragon: '<path d="M4 18.5c0-6 4-11 10-11 3 0 5 1.5 6 3.5-2 .5-3 1.5-3 3 0 2-2 4.5-4 4.5z" fill="#8cd96a"/><circle cx="15" cy="11" r="1" fill="#1f2a44"/><path d="M8 8L6.5 4M12 7V3.5"/>',
  ruin: '<path d="M4 20.5V11l5-4 4 3 3-2 4 3v9.5z" fill="#c8c0b5"/><path d="M10 20.5v-5h4v5"/>',
  flower: '<circle cx="12" cy="5.8" r="3.2" fill="#ff9ec4"/><circle cx="18.2" cy="10.4" r="3.2" fill="#ff9ec4"/><circle cx="15.8" cy="17.6" r="3.2" fill="#ff9ec4"/><circle cx="8.2" cy="17.6" r="3.2" fill="#ff9ec4"/><circle cx="5.8" cy="10.4" r="3.2" fill="#ff9ec4"/><circle cx="12" cy="12" r="2.4" fill="#ffcf3a"/>',
  // buttons and small marks
  cloud: '<path d="M7 18.5a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10a4.3 4.3 0 01-.5 8.5z" fill="#e8f3ff"/>',
  chat: '<path d="M4 5.5h16v10.5H11l-4.5 3.8V16H4z" fill="#fff"/><path d="M8 10.5h8"/>',
  gift: '<rect x="3.5" y="10" width="17" height="10.5" rx="1.5" fill="#ff8a5c"/><rect x="2.5" y="6.5" width="19" height="3.5" rx="1" fill="#ffcf3a"/><path d="M12 6.5v14M12 6.5C9.5 2.5 6 3.5 7 5.8M12 6.5c2.5-4 6-3 5-.7"/>',
  target: '<circle cx="12" cy="12" r="9" fill="#fff"/><circle cx="12" cy="12" r="5" fill="#ff6b57"/><circle cx="12" cy="12" r="1.6" fill="#fff"/>',
  camera: '<path d="M3.5 8h4l1.5-2.5h6L16.5 8h4v11.5h-17z" fill="#fff"/><circle cx="12" cy="13.5" r="3.6" fill="#8ccbff"/>',
  teddy: '<circle cx="6" cy="6" r="2.5" fill="#d9a066"/><circle cx="18" cy="6" r="2.5" fill="#d9a066"/><circle cx="12" cy="13" r="8" fill="#e8b97a"/><circle cx="9" cy="12" r="1" fill="#1f2a44"/><circle cx="15" cy="12" r="1" fill="#1f2a44"/><ellipse cx="12" cy="15.5" rx="2.6" ry="2" fill="#fff"/>',
  sparkle: '<path d="M12 2.5l2.3 7.2L21.5 12l-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3z" fill="#ffcf3a"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke-width="3"/>',
  // treasures
  key: '<circle cx="8" cy="8" r="4.5" fill="#ffcf3a"/><circle cx="8" cy="8" r="1.4" fill="#fff"/><path d="M11.5 11.5L21 21M17 17l2.5-2.5M14.5 14.5l2-2"/>',
  crown: '<path d="M3 18.5V8l5 5 4-7 4 7 5-5v10.5z" fill="#ffcf3a"/>',
  gem: '<path d="M6 4h12l4 5.5-10 11-10-11z" fill="#6fb8ff"/><path d="M2 9.5h20M9 4l-2 5.5 5 11M15 4l2 5.5-5 11"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="#ffcf3a"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9v6"/>',
  scroll: '<path d="M6 4h12v14a2.5 2.5 0 01-2.5 2.5H6.5A2.5 2.5 0 014 18v-1h2z" fill="#fff0c9"/><path d="M9 9h6M9 12.5h6"/>',
  compass: '<circle cx="12" cy="12" r="9.5" fill="#fff"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#ff6b57"/>',
  orb: '<circle cx="12" cy="11" r="8" fill="#b79cff"/><path d="M8.5 19h7l1.5 2.5H7z" fill="#e8b97a"/><path d="M8.5 8.5a4 4 0 012.5-2" stroke="#fff"/>',
  potion: '<path d="M9.5 3.5h5M10.5 3.5v5L5 18a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5.5-9.5v-5" fill="#fff"/><path d="M7.5 15h9l1.7 3a1 1 0 01-.9 1.5H6.7A1 1 0 015.8 18z" fill="#6fe0a0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z" fill="#8ccbff"/><path d="M12 7v10M8 11h8"/>',
  sword: '<path d="M20 4l-.5 5.5L10 19l-5-5 9.5-9.5z" fill="#dfeaf5"/><path d="M6 12.5l5.5 5.5"/><path d="M4 20l3-3" stroke-width="3"/>',
  vase: '<path d="M9 3h6v3c0 2 3 3 3 8 0 4-2.5 7-6 7s-6-3-6-7c0-5 3-6 3-8z" fill="#e8a06a"/><path d="M7 12h10"/>',
  // conditions
  flame: '<path d="M12 21c-4 0-6.5-2.8-6.5-6.3 0-3 2.3-4.8 3.5-7.2.5 1.5 1.5 2 2.5 2 0-3 1-5 2.5-6.5.2 3 4.5 5 4.5 11 0 4-2.5 7-6.5 7z" fill="#ff8a3c"/><path d="M12 21c-2 0-3-1.4-3-3 0-1.8 1.6-2.8 3-4.5 1.2 1.5 3 2.5 3 4.5 0 1.6-1 3-3 3z" fill="#ffd36a"/>',
  skull: '<path d="M12 3c-4.5 0-7.5 3-7.5 7 0 2.5 1.2 4 2.5 5v3.5h10V15c1.3-1 2.5-2.5 2.5-5 0-4-3-7-7.5-7z" fill="#fff"/><circle cx="9" cy="11" r="1.8" fill="#1f2a44"/><circle cx="15" cy="11" r="1.8" fill="#1f2a44"/><path d="M10.5 18.5v-2M13.5 18.5v-2"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h5.5l-1.5 8 9.5-12H13z" fill="#ffcf3a"/>',
  zzz: '<path d="M5 6h6L5 13h6M13 12h5l-5 6h5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  swirl: '<path d="M12 12a2 2 0 114 0 4 4 0 11-8 0 6 6 0 0112 0 8 8 0 11-16 0"/>',
  burst: '<path d="M12 2l2.2 6 6-2.2-3 5.7 5.3 3.2-6.2.7.5 6.3-4.8-4-4.8 4 .5-6.3-6.2-.7 5.3-3.2-3-5.7 6 2.2z" fill="#ffcf3a"/>',
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function svg(name: IconName, cls = ''): string {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** The emoji the data uses, and the drawn icon that stands in for each. */
export const GLYPHS: Record<string, IconName> = {
  '🏡': 'house', '🏙': 'city', '⛰': 'mountain', '🌲': 'forest', '🏝': 'lake', '🏆': 'league', '🏛': 'city',
  '🛤': 'road', '🌊': 'wave', '🌾': 'meadow', '📍': 'pin',
  '🏭': 'plant', '🗼': 'tower', '🎡': 'wheel', '🥋': 'fist', '🌋': 'volcano', '🏔': 'snowhut', '🐉': 'dragon', '🏚': 'ruin', '🌸': 'flower',
  '🗝': 'key', '👑': 'crown', '💎': 'gem', '🪙': 'coin', '📜': 'scroll', '🧭': 'compass', '🔮': 'orb', '⚗': 'potion', '🛡': 'shield', '⚔': 'sword', '🏺': 'vase',
  '🔥': 'flame', '☠': 'skull', '⚡': 'bolt', '💤': 'zzz', '❄': 'snow', '💫': 'swirl', '💥': 'burst',
  '🎁': 'gift', '☁': 'cloud', '💬': 'chat', '🎯': 'target', '📷': 'camera', '🧸': 'teddy', '✨': 'sparkle',
};

const strip = (e: string): string => e.replace(/️/g, '');

/** An emoji from the data as a drawn icon; anything we have not drawn (word pictures…) stays as it was. */
export function glyph(e: string | undefined, cls = ''): string {
  if (!e) return '';
  const name = GLYPHS[strip(e)];
  return name ? svg(name, cls) : e;
}
