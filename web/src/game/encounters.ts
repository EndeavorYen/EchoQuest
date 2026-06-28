import type { Level } from '../data/levels';
import type { LearnerProfile } from './challenges';

export type EncounterIntent = {
  kind: 'flame' | 'trick' | 'guard' | 'spell' | 'seal';
  label: string;
  text: string;
};

const INTENT_BY_LEVEL_ID: Record<number, EncounterIntent['kind']> = {
  1: 'flame',
  2: 'trick',
  3: 'guard',
  4: 'spell',
};

const LABEL_BY_KIND: Record<EncounterIntent['kind'], string> = {
  flame: '火焰預告',
  trick: '搗蛋預告',
  guard: '護盾預告',
  spell: '咒語預告',
  seal: '封印預告',
};

const TEXT_BY_KIND: Record<EncounterIntent['kind'], Record<LearnerProfile, string>> = {
  flame: {
    toddler: '小龍準備吹熱風，找對圖片就會停下來。',
    kid: '巨龍正在蓄火，答對單字可以打斷牠。',
    adult: 'Dragon is charging flame. Correct answers interrupt the cast.',
  },
  trick: {
    toddler: '小怪想藏圖片，找對就抓到牠。',
    kid: '哥布林想偷星星，答對可以追回節奏。',
    adult: 'Goblin is setting a trick. Keep combo to deny the steal.',
  },
  guard: {
    toddler: '石像舉起大手，選對圖片就放下。',
    kid: '石像巨人舉盾，連續答對可以敲開防守。',
    adult: 'Golem is guarding. Sustained accuracy breaks the guard.',
  },
  spell: {
    toddler: '魔法師念咒，找對圖片讓咒語變亮。',
    kid: '魔王正在施法，答對單字讓咒語反彈。',
    adult: 'Wizard is casting. Correct answers reflect the spell.',
  },
  seal: {
    toddler: '門在等正確的圖片。',
    kid: '魔法門需要正確工具來解除封印。',
    adult: 'Gate seal requires the matching tool word.',
  },
};

export function getEncounterIntent(level: Level, profile: LearnerProfile): EncounterIntent {
  const kind = level.type === 'puzzle' ? 'seal' : INTENT_BY_LEVEL_ID[level.id] ?? 'spell';

  return {
    kind,
    label: LABEL_BY_KIND[kind],
    text: TEXT_BY_KIND[kind][profile],
  };
}
