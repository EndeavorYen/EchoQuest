import type { Level } from '../data/levels';
import { getEncounterIntent } from './encounters';

const boss = (id: number): Level => ({
  id,
  name: 'Boss',
  type: 'boss',
  description: '',
  imageEmoji: '',
  requiredWords: 3,
  enemyLives: 3,
});

describe('encounter intents', () => {
  it('maps dragon levels to a flame intent', () => {
    expect(getEncounterIntent(boss(1), 'adult')).toMatchObject({
      kind: 'flame',
      label: '火焰預告',
      text: 'Dragon is charging flame. Correct answers interrupt the cast.',
    });
  });

  it('uses gentle toddler copy for boss intents', () => {
    expect(getEncounterIntent(boss(2), 'toddler').text).toBe('小怪想藏圖片，找對就抓到牠。');
  });

  it('uses gate seal intent for puzzle levels', () => {
    const level: Level = {
      id: 5,
      name: 'Gate',
      type: 'puzzle',
      description: '',
      imageEmoji: '',
      requiredWords: 2,
      tools: ['key'],
    };

    expect(getEncounterIntent(level, 'kid')).toMatchObject({
      kind: 'seal',
      text: '魔法門需要正確工具來解除封印。',
    });
  });
});
