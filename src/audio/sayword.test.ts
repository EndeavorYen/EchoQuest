import { describe, expect, it, vi } from 'vitest';

describe('sayWord: English first, then Chinese', () => {
  it('queues the English word, then its meaning', async () => {
    const spoken: { text: string; lang: string }[] = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; constructor(public text: string) {} });
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [],
      cancel: () => { spoken.length = 0; },
      speak: (u: { text: string; lang: string }) => spoken.push({ text: u.text, lang: u.lang }),
      addEventListener: () => {},
    });
    const { sayWord, sfx } = await import('./sfx');
    sfx.enabled = true;
    sayWord('under', '在…下面');
    expect(spoken).toEqual([{ text: 'under', lang: 'en-US' }, { text: '在…下面', lang: 'zh-TW' }]);
    sayWord('hi', '');
    expect(spoken).toEqual([{ text: 'hi', lang: 'en-US' }]);
    sfx.enabled = false;
    sayWord('mute', '靜音');
    expect(spoken).toEqual([{ text: 'hi', lang: 'en-US' }]);
  });
});
