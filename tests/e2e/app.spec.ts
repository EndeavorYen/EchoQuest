import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The Pokémon-style app (index.html). The old pixel game lives at /classic.html and has its own spec.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function open(page: Page, query = ''): Promise<void> {
  // stay offline: tiny stand-in pictures, empty font css
  await page.route(/pokeapi|githubusercontent/, (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  // ordinary tests get spoken rounds only; tests of the other kinds ask for them with &rounds=…
  await page.goto(`/?debug${query.includes('rounds=') ? query : `${query}&rounds=speak`}`);
  await page.waitForFunction(() => (window as any).__app);
}

const go = (page: Page, name: string, params?: unknown) => page.evaluate(([n, p]) => (window as any).__app.go(n, p), [name, params] as const);
const ctl = <T>(page: Page, fn: (c: any) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__v3)`) as Promise<T>;
const save = <T>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__app.save)`) as Promise<T>;

/** Step onto the first neighbour of the start town; the creature of that place is shown. */
async function walkToFight(page: Page): Promise<void> {
  await page.locator('.tnode[data-state=next]').first().click();
  await expect(page.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
}
/** From the reveal to the battle. */
async function startFight(page: Page): Promise<void> {
  await page.click('[data-screen=reveal] #go:not([disabled])');
  await page.waitForFunction(() => (window as any).__v3?.battle);
}

/** Put the party on a place next to `id`, then tap `id`: it goes straight there. */
async function approach(page: Page, id: number): Promise<void> {
  await page.evaluate((target) => {
    const a = (window as any).__app;
    const m = a.save.townmap;
    const link = m.links.find((l: number[]) => l.includes(target));
    const from = link[0] === target ? link[1] : link[0];
    a.update((s: any) => ({ ...s, townmap: { ...m, at: from, visited: [...new Set([...m.visited, from])] } }));
    a.go('trek');
  }, id);
  await page.locator(`.tnode[data-id="${id}"]`).click();
  await expect(page.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
}

async function sayWord(game: any, page: Page): Promise<void> {
  const word = await page.locator('#theWord').innerText();
  await game.say(word);
  await page.click('[data-act=mic]');
}

test.describe('home and menus', () => {
  test('the home screen offers every mode and each one opens', async ({ game }) => {
    const p = game.page;
    await open(p);
    await expect(p.locator('[data-screen=home]')).toBeVisible();
    for (const [btn, screen] of [['dex', 'dex'], ['practice', 'practice'], ['party', 'party'], ['trek', 'trek']] as const) {
      await p.click(`.menu [data-go=${btn}]`);
      await expect(p.locator(`[data-screen=${screen}]`)).toBeVisible();
      await p.click('[data-screen] .bar [data-go]');
      await expect(p.locator('[data-screen=home]')).toBeVisible();
    }
  });
});

test.describe('scan and battle', () => {
  test('the place decides who turns up (no camera); then fight it with spoken words', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await walkToFight(p);
    await expect(p.locator('#cam')).toHaveCount(0);
    await startFight(p);
    await expect(p.locator('#theWord')).toBeVisible();
    const before = await ctl(p, (c) => c.battle.monster.hp);
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(before);
  });

  test('three misses, then a grown-up confirms; the heard word is learned', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await game.say('zzzz', 'zzzz');
    for (let i = 0; i < 2; i++) {
      await p.click('[data-act=mic]');
      await expect(p.locator('#note')).toContainText('再試一次');
    }
    const before = await ctl(p, (c) => c.battle.monster.hp);
    await p.click('[data-act=ok]');
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(before);
    expect(await save(p, (s) => Object.keys(s.aliases).length)).toBe(1);
  });

  test('a recogniser that hears nothing never traps an attack: after three tries "I said it" and "skip" appear', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    for (let i = 1; i <= 3; i++) {
      await expect(p.locator('.stuck')).toHaveCount(0);
      await p.click('[data-act=mic]'); // the fake engine has nothing queued: "no speech"
      await expect.poll(() => ctl(p, (c) => c.attempts)).toBe(i);
    }
    await expect(p.locator('.stuck [data-act=ok]')).toBeVisible();
    const before = await ctl(p, (c) => c.battle.monster.hp);
    await p.click('.stuck [data-act=skip]');
    await expect.poll(() => ctl(p, (c) => c.phase)).not.toBe('speak');
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBeGreaterThanOrEqual(before);
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem('echoquest.heard') ?? '[]'));
    expect(log.filter((e: any) => e.r === 'none')).toHaveLength(3);
    expect(log.at(-1)).toMatchObject({ r: 'skipped' });
  });

  test('stuck on an attack word: "I said it" counts as a hit and is logged', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    for (let i = 1; i <= 3; i++) {
      await p.click('[data-act=mic]');
      await expect.poll(() => ctl(p, (c) => c.attempts)).toBe(i);
    }
    const before = await ctl(p, (c) => c.battle.monster.hp);
    await p.click('.stuck [data-act=ok]');
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(before);
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem('echoquest.heard') ?? '[]'));
    expect(log.at(-1)).toMatchObject({ r: 'confirmed' });
  });

  test('defending: two attempts the engine cannot make out still raise a plain block, and it is logged', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    const hearts = await ctl(p, (c) => c.hearts);
    await p.click('[data-act=mic]');
    await expect.poll(() => ctl(p, (c) => c.attempts)).toBe(1);
    expect(await ctl(p, (c) => c.phase)).toBe('defend');
    await p.click('[data-act=mic]');
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).not.toBe('defend');
    // a plain block: nothing is bounced back at the creature, and nobody lost a heart
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBeGreaterThanOrEqual(hp);
    expect(await ctl(p, (c) => c.hearts)).toBe(hearts);
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem('echoquest.heard') ?? '[]'));
    expect(log.at(-1)).toMatchObject({ r: 'rescued', d: 1 });
  });

  test('copying the recognition log: stamped, new-only vs all, and nothing is deleted', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => {
      const mk = (n: number) => ({ n, w: 'bee', c: ['B'], r: 'confirmed', lv: 1, t: 1_700_000_000 + n, s: 1 });
      localStorage.setItem('echoquest.heard', JSON.stringify([mk(1), mk(2), mk(3)]));
      localStorage.setItem('echoquest.heard.seq', '3');
      (window as any).__copied = [];
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => void (window as any).__copied.push(s) }, configurable: true });
    });
    await p.click('.menu [data-go=party]');
    await expect(p.locator('#logNew')).toContainText('3');
    await p.click('#logNew');
    await expect(p.locator('#logmsg')).toContainText('第 1 次');
    await expect(p.locator('#logNew')).toContainText('（0）');
    await p.evaluate(() => {
      const a = JSON.parse(localStorage.getItem('echoquest.heard')!);
      a.push({ n: 4, w: 'she', c: ['see'], r: 'rescued', lv: 1, t: 1_700_000_100, s: 1, d: 1 });
      localStorage.setItem('echoquest.heard', JSON.stringify(a));
    });
    await p.click('[data-screen=party] .bar [data-go]');
    await p.click('.menu [data-go=party]');
    await expect(p.locator('#logNew')).toContainText('（1）');
    await p.click('#logAll');
    await expect(p.locator('#logmsg')).toContainText('第 2 次');
    const copied: string[] = await p.evaluate(() => (window as any).__copied);
    expect(copied[0]).toMatch(/^# EchoQuest 辨識回報\nID: EQ-\d{8}-\d{4}-[A-Z2-9]{4}\n匯出: 第 1 次/);
    expect(copied[0]).toContain('筆數: 3');
    expect(copied[1]).toContain('範圍: 全部紀錄');
    expect(copied[1]).toContain('筆數: 4');
    expect(copied[0].match(/ID: (\S+)/)![1]).not.toBe(copied[1].match(/ID: (\S+)/)![1]);
    // exporting never deletes anything
    expect(await p.evaluate(() => JSON.parse(localStorage.getItem('echoquest.heard')!).length)).toBe(4);
  });

  test('a wild 5★ met outside a gym still has a shield, a legendary look and a bigger entrance', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 383, name: '固拉多', type: 'ground', rarity: 5, colors: ['#D11115', '#DAD7DE'] }, boss: false });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    expect(await ctl(p, (c) => c.shield.max)).toBe(3);
    await expect(p.locator('#shields')).toBeVisible();
    await expect(p.locator('#arena')).toHaveAttribute('data-grade', 'legend');
    await expect(p.locator('.banner.legend')).toContainText('傳說');
  });

  test('a wild 4★ has a two-layer shield and the rare look; a 3★ wild has neither', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 149, name: '快龍', type: 'dragon', rarity: 4, colors: ['#D11115'] }, boss: false });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    expect(await ctl(p, (c) => c.shield.max)).toBe(2);
    await expect(p.locator('#arena')).toHaveAttribute('data-grade', 'rare');
    await go(p, 'battle', { foe: { id: 3, name: '妙蛙花', type: 'normal', rarity: 3, colors: ['#A179B1'] }, boss: false });
    await p.waitForFunction(() => (window as any).__v3?.battle && !(window as any).__v3.shield);
    await expect(p.locator('#arena')).toHaveAttribute('data-grade', 'common');
    await expect(p.locator('.banner')).toHaveCount(0);
  });

  test('the reveal screen of a 5★ is dressed up too', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'scan', { kind: 'trek', foe: { id: 383, name: '固拉多', type: 'ground', rarity: 5, colors: ['#D11115'] }, place: { key: 'cave', types: ['ground'], maxRarity: 5 } });
    await expect(p.locator('.reveal.g-legend .rarebanner')).toContainText('傳說登場');
  });

  test('a win is a catch: the creature goes into a ball that wobbles three times and locks, with a buzz on each beat', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => { (window as any).__vib = []; (navigator as any).vibrate = (v: unknown) => ((window as any).__vib.push(v), true); });
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => c.win());
    await expect(p.locator('.ball')).toHaveCount(1);
    await expect(p.locator('.ball.locked')).toHaveCount(1, { timeout: 5000 });
    await expect(p.locator('[data-act=next]')).toBeVisible({ timeout: 5000 });
    const vib = await p.evaluate(() => (window as any).__vib);
    expect(vib).toEqual([[35], [20], [20], [20], [140]]);
    // the next fight starts with a clean arena
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await expect(p.locator('.ball')).toHaveCount(0);
  });

  test('a legendary catch gets a golden ball and a longer rumble; the vibration switch turns it off', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => { (window as any).__vib = []; (navigator as any).vibrate = (v: unknown) => ((window as any).__vib.push(v), true); });
    await go(p, 'battle', { foe: { id: 383, name: '固拉多', type: 'ground', rarity: 5, colors: ['#D11115'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => c.win());
    await expect(p.locator('.ball.locked')).toHaveCount(1, { timeout: 5000 });
    const vib: number[][] = await p.evaluate(() => (window as any).__vib);
    expect(vib.at(-1)!.length).toBeGreaterThan(3);
    expect(await p.locator('.ball').evaluate((e) => getComputedStyle(e).getPropertyValue('--c').trim())).toBe('#f5b800');
    // switch it off in the party settings
    await go(p, 'party');
    await p.click('#buzz');
    expect(await save(p, (s) => s.haptics)).toBe(false);
    await p.evaluate(() => { (window as any).__vib = []; });
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => c.win());
    await expect(p.locator('[data-act=next]')).toBeVisible({ timeout: 5000 });
    expect(await p.evaluate(() => (window as any).__vib)).toEqual([]);
  });

  test('hear it, pick it: the right picture attacks; two wrong picks fizzle', async ({ game }) => {
    const p = game.page;
    await open(p, '&rounds=listen');
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: s.players.map((x: any) => ({ ...x, level: 2 })) })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    const until = () => ctl(p, (c) => { for (let i = 0; i < 80 && c.round !== 'listen'; i++) c.deal(); return c.round; });
    expect(await until()).toBe('listen');
    await expect(p.locator('.panel[data-mode=listen] .choice')).toHaveCount(3);
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    const right = await ctl(p, (c) => c.word.id);
    await p.locator(`.choice[data-id="${right}"]`).click();
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(hp);
    // a fresh listen round: miss twice
    // let the counter-attack through (time runs out); the next attack card is dealt
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await ctl(p, (c) => { c.defLeft = 0.05; });
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
    expect(await until()).toBe('listen');
    const hp2 = await ctl(p, (c) => c.battle.monster.hp);
    const wrong = await ctl(p, (c) => c.listenR.options.filter((o: any) => o.id !== c.word.id).map((o: any) => o.id));
    await p.locator(`.choice[data-id="${wrong[0]}"]`).click();
    await expect(p.locator('.choice.x')).toHaveCount(1);
    expect(await ctl(p, (c) => c.phase)).toBe('speak');
    await p.locator(`.choice[data-id="${wrong[1]}"]`).click();
    await expect.poll(() => ctl(p, (c) => c.phase)).not.toBe('speak');
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBe(hp2);
  });

  test('fill in the letters: tapping them in order attacks; three wrong letters fizzle', async ({ game }) => {
    const p = game.page;
    await open(p, '&rounds=spell');
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: s.players.map((x: any) => ({ ...x, level: 3 })) })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    const until = () => ctl(p, (c) => { for (let i = 0; i < 80 && c.round !== 'spell'; i++) c.deal(); return c.round; });
    expect(await until()).toBe('spell');
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    for (;;) {
      const next = await ctl(p, (c) => {
        const s = c.spellR;
        if (s.filled >= s.blanks.length) return -1;
        const want = s.letters[s.blanks[s.filled]];
        return s.tiles.findIndex((x: string, i: number) => x === want && !s.used[i]);
      });
      if (next < 0) break;
      await p.locator(`.tile[data-i="${next}"]`).click();
    }
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(hp);
    // let the counter-attack through (time runs out); the next attack card is dealt
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await ctl(p, (c) => { c.defLeft = 0.05; });
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
    expect(await until()).toBe('spell');
    const hp2 = await ctl(p, (c) => c.battle.monster.hp);
    const bad = await ctl(p, (c) => { const s = c.spellR; const want = s.letters[s.blanks[0]]; return s.tiles.findIndex((x: string) => x !== want); });
    for (let i = 0; i < 3; i++) await p.locator(`.tile[data-i="${bad}"]`).click();
    await expect.poll(() => ctl(p, (c) => c.phase)).not.toBe('speak');
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBe(hp2);
  });

  test('memory match: finding all three pairs is a perfect attack', async ({ game }) => {
    const p = game.page;
    await open(p, '&rounds=memory');
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: s.players.map((x: any) => ({ ...x, level: 2 })) })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    expect(await ctl(p, (c) => { for (let i = 0; i < 80 && c.round !== 'memory'; i++) c.deal(); return c.round; })).toBe('memory');
    await expect(p.locator('.mcard')).toHaveCount(6);
    // one wrong pair first: both flip back
    const ids: string[] = await ctl(p, (c) => c.memR.cards.map((x: any) => x.word.id));
    const first = 0;
    const other = ids.findIndex((id) => id !== ids[first]);
    await p.locator(`.mcard[data-i="${first}"]`).click();
    await p.locator(`.mcard[data-i="${other}"]`).click();
    await expect(p.locator('.mcard.up')).toHaveCount(0, { timeout: 3000 });
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    for (const id of [...new Set(ids)]) {
      const [a, b] = ids.map((x, i) => (x === id ? i : -1)).filter((i) => i >= 0);
      await p.locator(`.mcard[data-i="${a}"]`).click();
      await p.locator(`.mcard[data-i="${b}"]`).click();
    }
    await expect(p.locator('.mcard.done')).toHaveCount(6);
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(hp);
    // used once a fight
    expect(await ctl(p, (c) => c.memoryUsed)).toBe(true);
  });

  test('a word said right gives the active partner experience', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    const id = await ctl(p, (c) => c.partnerMon(c.me).id);
    await sayWord(game, p);
    await expect.poll(() => save(p, (s) => s.growth?.[25]?.xp ?? 0)).toBeGreaterThan(0);
    expect(id).toBe(25);
    expect(await p.locator('#xpBar').evaluate((e) => parseFloat((e as HTMLElement).style.width))).toBeGreaterThan(0);
  });

  test('a raised partner draws hard words (one level up); one said right is a critical hit', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, growth: { 25: { xp: 0, rank: 3, stars: 1 } } })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; c.battle.monster.hp = c.battle.monster.maxHp = 999; });
    expect(await ctl(p, (c) => { for (let i = 0; i < 200 && !c.hard; i++) c.deal(); return c.hard; })).toBe(true);
    expect(await ctl(p, (c) => c.word.lv)).toBe(2); // the player is level 1
    await expect(p.locator('.hardtag')).toBeVisible();
    await sayWord(game, p);
    await expect(p.locator('.banner.crit')).toBeVisible();
    // perfect level-2 word ×1.5
    await expect.poll(() => ctl(p, (c) => 999 - c.battle.monster.hp)).toBe(30);
  });

  test('a full bar evolves the partner after the win: Pikachu becomes Raichu, joins the dex and keeps fighting', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, growth: { 25: { xp: 30, rank: 0, stars: 0 } } })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await expect(p.locator('#xpline.ready')).toHaveCount(1);
    await ctl(p, (c) => c.win());
    await expect(p.locator('.victory .grown')).toContainText('皮卡丘 進化成 雷丘', { timeout: 15_000 });
    const s = await save(p, (x) => ({ mon: x.players[0].mon, caught: x.caught, g26: x.growth[26], g25: x.growth[25] }));
    expect(s.mon).toBe(26);
    expect(s.caught).toContain(26);
    expect(s.g26).toEqual({ xp: 0, rank: 1, stars: 0 });
    expect(s.g25).toBeUndefined();
    await expect(p.locator('#meName')).toHaveText('雷丘');
    await expect(p.locator('#meRank')).toHaveText('★');
  });

  test('a creature that cannot evolve gains a star instead', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: s.players.map((x: any) => ({ ...x, mon: 383 })), growth: { 383: { xp: 30, rank: 0, stars: 0 } } })));
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => c.win());
    await expect(p.locator('.victory .grown')).toContainText('固拉多 升到 ★', { timeout: 15_000 });
    expect(await save(p, (x) => x.growth[383])).toEqual({ xp: 0, rank: 1, stars: 1 });
  });

  test('the party screen shows each partner\'s growth, and round kinds can be switched off', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, growth: { 25: { xp: 12, rank: 1, stars: 0 } } })));
    await go(p, 'party');
    await expect(p.locator('[data-grow="25"] .rank')).toHaveText('★');
    await expect(p.locator('.pcard')).toContainText('再 38 經驗就進化');
    await p.click('[data-round=spell]');
    expect(await save(p, (s) => s.rounds)).toEqual({ listen: true, spell: false, memory: true });
    await expect(p.locator('[data-round=spell]')).toContainText('關');
  });

  test('winning adds the creature to the dex and the trek moves on', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await walkToFight(p);
    const target = await save(p, (s) => s.townmap.entering);
    await startFight(p);
    await ctl(p, (c) => { c.battle.monster.hp = 1; });
    await sayWord(game, p);
    await expect(p.locator('.victory')).toBeVisible({ timeout: 8000 });
    await expect(p.locator('.newmon')).toBeVisible();
    expect(await save(p, (s) => s.caught.length)).toBe(1);
    expect(await save(p, (s) => s.townmap.cleared)).toEqual([target]);
    expect(await save(p, (s) => s.townmap.at)).toBe(target);
    await p.click('[data-act=next]');
    await expect(p.locator('[data-screen=trek] .townmap')).toBeVisible();
    expect(await save(p, (s) => s.townmap.entering)).toBeNull();
  });
});

/** Keep answering whatever the battle asks (a spell or a shield word) until `done` is true. */
async function playUntil(game: any, page: Page, done: () => Promise<boolean>, limit = 120): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await done()) return;
    const phase = await ctl(page, (c) => c.phase);
    if (phase === 'speak' || phase === 'defend') {
      if (await page.locator('[data-act=mic]').count()) await sayWord(game, page);
    }
    await page.waitForTimeout(350);
  }
  throw new Error('battle did not reach the expected state');
}

const MOUSE = { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] };
const BOSS = { id: 150, name: '超夢', type: 'psychic', rarity: 5, colors: ['#B8A8C8'] };

test.describe('co-op boss', () => {
  test('a child strips a layer with each spell and wins once it is down', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: BOSS, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    await expect(p.locator('#shields')).toBeVisible();
    test.setTimeout(180_000);
    const max = await ctl(p, (c) => c.shield.max);
    expect(max).toBeGreaterThanOrEqual(3);
    await playUntil(game, p, async () => (await ctl(p, (c) => c.shield.layers)) <= max - 1);
    await playUntil(game, p, async () => (await ctl(p, (c) => c.shield.layers)) === 0);
    await expect(p.locator('#shields')).toContainText('護盾破了');
    await playUntil(game, p, async () => (await p.locator(".victory").count()) > 0, 160);
    await expect(p.locator('.victory')).toBeVisible();
  });

  test('a grown-up is bounced while the shield is up: no layer, no damage; a child can break it', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: [{ ...s.players[0], name: 'Mom', adult: true }, { ...s.players[0], id: 'kid', name: 'Kid' }] })));
    await go(p, 'battle', { foe: BOSS, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    await expect(p.locator('.pbtn .adult')).toHaveCount(1);
    await expect(p.locator('.panel .hint')).toContainText('彈開');
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    const layers = await ctl(p, (c) => c.shield.layers);
    await sayWord(game, p);
    await expect(p.locator('.float', { hasText: '被護盾彈開了' })).toBeVisible({ timeout: 8000 });
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBe(hp);
    expect(await ctl(p, (c) => c.shield.layers)).toBe(layers);
    // the foe strikes back: block it, then let the child have a go
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
    await p.click('.pbtn[data-i="1"]');
    await expect(p.locator('.panel .hint')).toContainText('打破護盾');
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.shield.layers), { timeout: 8000 }).toBe(layers - 1);
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(hp);
  });

  test('once the shield is down, grown-ups can hurt the boss too', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: [{ ...s.players[0], name: 'Mom', adult: true }, { ...s.players[0], id: 'kid', name: 'Kid' }] })));
    await go(p, 'battle', { foe: BOSS, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    await ctl(p, (c) => { c.shield.layers = 0; });
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp), { timeout: 8000 }).toBeLessThan(hp);
  });
});

test.describe('defense', () => {
  test('even a level-1 player gets a shield round after casting, and a good defense shows its outcome', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await expect(p.locator('.panel.defend')).toBeVisible();
    await expect(p.locator('.timer')).toBeVisible();
    await sayWord(game, p);
    await expect(p.locator('.float', { hasText: /擋住|閃躲|反彈|反擊/ }).first()).toBeVisible({ timeout: 6000 });
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
  });

  test('each defense outcome plays out: block, dodge, reflect and counter', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; c.battle.monster.hp = c.battle.monster.maxHp = 500; });
    for (const kind of ['block', 'dodge', 'reflect', 'counter']) {
      await ctl(p, (c) => { c.dead = false; });
      // force the roll: swap the controller's rng for one that always lands on the wanted outcome
      const ok = await p.evaluate((k) => {
        const c = (window as any).__v3;
        const want: Record<string, number> = { block: 0.05, dodge: 0.2, reflect: 0.5, counter: 0.9 };
        const real = c.rng.next.bind(c.rng);
        c.rng.next = () => want[k];
        c.startDefend(30);
        c.rng.next = real;
        return c.phase;
      }, kind);
      expect(ok).toBe('defend');
      await p.evaluate((k) => { const c = (window as any).__v3; const want: Record<string, number> = { block: 0.05, dodge: 0.2, reflect: 0.5, counter: 0.9 }; c.rng.next = () => want[k]; c.resolveDefense(true, 'perfect'); }, kind);
      const label = { block: '擋住', dodge: '閃躲', reflect: '反彈', counter: '反擊' }[kind]!;
      await expect(p.locator('.float', { hasText: label }).first()).toBeVisible({ timeout: 6000 });
      await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
    }
  });

  test('a spell can leave a condition; a sleeping creature skips its counter-attack', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.aff.apply('sleep'); c.refreshStatus(); });
    await expect(p.locator('#status')).toContainText('睡眠');
    await sayWord(game, p);
    await expect(p.locator('.float', { hasText: '動不了' })).toBeVisible({ timeout: 8000 });
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
  });

  test('running out of time lets the hit through and the creature recovers a little', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    const hp = await ctl(p, (c) => c.battle.monster.hp);
    await ctl(p, (c) => { c.defLeft = 0.05; });
    await expect(p.locator('.float', { hasText: '好痛' })).toBeVisible({ timeout: 6000 });
    expect(await ctl(p, (c) => c.battle.monster.hp)).toBeGreaterThanOrEqual(hp);
  });

  test('every type has its own move that lands', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    const types = await p.evaluate(() => Object.keys((window as any).__types));
    expect(types.length).toBe(18);
    for (const t of types) {
      const landed = await p.evaluate(
        (key) => new Promise<boolean>((res) => {
          const c = (window as any).__v3;
          const fx = (window as any).__types[key].fx;
          const timer = setTimeout(() => res(false), 4000);
          c.view.cast('me', fx.style, fx.colors, 1, () => { clearTimeout(timer); res(true); });
        }),
        t,
      );
      expect(landed, `move for ${t}`).toBe(true);
    }
  });
});

test.describe('word card', () => {
  test('a word with a picture shows it in a box; a word without one gets no box and no long Chinese squeezed in', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] } });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    const show = (word: object) => p.evaluate((w) => (window as any).__v3.view.showWord({ mode: 'speak', word: w, hint: 'x' }), word);
    await show({ id: 'a', w: 'dog', zh: '狗', icon: '🐶' });
    await expect(p.locator('.wordrow .pic')).toHaveText('🐶');
    await show({ id: 'b', w: 'although', zh: '雖然、儘管如此' });
    await expect(p.locator('.wordrow .pic')).toHaveCount(0);
    await expect(p.locator('.wordrow')).toHaveClass(/nopic/);
    await expect(p.locator('.wordrow .zh')).toHaveText('雖然、儘管如此'); // the meaning stays under the word
    await expect(p.locator('#theWord')).toHaveText('although');
  });
});

test.describe('what is new', () => {
  test('the info button opens the update notes; the red dot goes once they were read', async ({ game }) => {
    const p = game.page;
    await open(p);
    await expect(p.locator('#infodot')).toBeVisible();
    await p.click('#info');
    await expect(p.locator('[data-screen=changelog]')).toContainText('城鎮地圖');
    await expect(p.locator('.rel-list article.new')).toHaveCount(1);
    await p.click('[data-screen=changelog] [data-close]');
    await expect(p.locator('[data-screen=changelog]')).toHaveCount(0);
    await go(p, 'party');
    await go(p, 'home');
    await expect(p.locator('#infodot')).toBeHidden();
    await p.click('#info');
    await expect(p.locator('.rel-list article.new')).toHaveCount(0);
  });
});

test.describe('dex and party', () => {
  test('the dex marks caught creatures and a caught one can become the partner', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, caught: [6, 25] })));
    await go(p, 'dex');
    await expect(p.locator('.bar h1')).toContainText('2 /');
    await expect(p.locator('.dexcell')).toHaveCount(12);
    await expect(p.locator('.dexcell:not(.unknown)')).toHaveCount(1); // only #6 is on the first page
    await p.click('.dexcell[data-id="6"]');
    await p.click('[data-seat="0"]');
    expect(await save(p, (s) => s.players[0].mon)).toBe(6);
  });

  test('the dex pages through a generation, by buttons and by swiping', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'dex');
    await expect(p.locator('#pageinfo')).toHaveText('第 1 頁／共 13 頁'); // 151 creatures, 12 a page
    await expect(p.locator('#prev')).toBeDisabled();
    await p.click('#next');
    await expect(p.locator('#pageinfo')).toHaveText('第 2 頁／共 13 頁');
    await expect(p.locator('.dexcell').first()).toHaveAttribute('data-id', '13');
    // swipe left = next page, swipe right = back
    const drag = (from: number, to: number): Promise<void> =>
      p.evaluate(([x1, x2]) => {
        const el = document.querySelector('#dexarea')!;
        const r = el.getBoundingClientRect();
        const y = r.top + r.height / 2;
        const ev = (type: string, x: number): PointerEvent => new PointerEvent(type, { clientX: r.left + r.width * x, clientY: y + 3, bubbles: true, pointerId: 1 });
        el.dispatchEvent(ev('pointerdown', x1));
        el.dispatchEvent(ev('pointerup', x2));
      }, [from, to]);
    await drag(0.9, 0.1);
    await expect(p.locator('#pageinfo')).toHaveText('第 3 頁／共 13 頁');
    await drag(0.1, 0.9);
    await expect(p.locator('#pageinfo')).toHaveText('第 2 頁／共 13 頁');
    // changing generation starts again from page 1
    await p.click('[data-gen="1"]');
    await expect(p.locator('#pageinfo')).toContainText('第 1 頁');
    await expect(p.locator('.dexcell').first()).toHaveAttribute('data-id', '152');
  });

  test('"caught only" hides the rest and pages over what is left', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, caught: [6, 25, 133] })));
    await go(p, 'dex');
    await p.check('#only');
    await expect(p.locator('.dexcell')).toHaveCount(3);
    await expect(p.locator('.dexcell.unknown')).toHaveCount(0);
    await expect(p.locator('#pageinfo')).toHaveText('第 1 頁／共 1 頁');
    await expect(p.locator('#next')).toBeDisabled();
    await p.uncheck('#only');
    await expect(p.locator('.dexcell')).toHaveCount(12);
    // a generation with nothing caught says so instead of showing an empty grid
    await p.check('#only');
    await p.click('[data-gen="2"]');
    await expect(p.locator('.dexcell')).toHaveCount(0);
    await expect(p.locator('.dexempty')).toBeVisible();
  });

  test('the sheet shows the evolution family: current one framed, unknown ones hidden', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, caught: [4, 5] })));
    await go(p, 'dex');
    await p.click('.dexcell[data-id="5"]');
    await expect(p.locator('.evo-chip')).toHaveCount(3);
    await expect(p.locator('.evo-chip.cur')).toContainText('No.5');
    await expect(p.locator('.evo-chip.unk')).toHaveCount(1); // #6 not caught yet: silhouette and a question mark
    await expect(p.locator('.evo-chip.unk')).toContainText('？？？');
    await p.click('.evo-chip[data-evo="4"]'); // a caught relative opens its own sheet
    await expect(p.locator('.evo-chip.cur')).toContainText('No.4');
    await p.click('.evo-chip.unk');
    await expect(p.locator('.toast')).toBeVisible();
    // a branching family keeps every branch
    await p.click('[data-close]');
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, caught: [133] })));
    await go(p, 'home');
    await go(p, 'dex');
    await p.check('#only');
    await p.click('.dexcell[data-id="133"]');
    await expect(p.locator('.evo-chip')).toHaveCount(9);
    await expect(p.locator('.evo-chip.cur')).toContainText('No.133');
  });

  test('the party screen adds players, changes level and swaps the partner', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'party');
    await p.click('#add');
    await expect(p.locator('.pcard')).toHaveCount(2);
    await p.click('[data-lv="1"][data-d="1"]');
    expect(await save(p, (s) => s.players[1].level)).toBe(2);
    await p.click('[data-pick="0"]');
    await p.click('.choices [data-mon="4"]');
    expect(await save(p, (s) => s.players[0].mon)).toBe(4);
    await p.click('[data-del="1"]');
    await expect(p.locator('.pcard')).toHaveCount(1);
  });
});

test.describe('practice and toddler', () => {
  test('practice: a spoken word is marked right and the next one comes', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'practice');
    const w1 = await p.locator('#theWord').innerText();
    await sayWord(game, p);
    await expect(p.locator('#score')).toHaveText('答對 1 個');
    await expect(p.locator('#theWord')).toBeVisible({ timeout: 5000 });
    expect(w1.length).toBeGreaterThan(0);
  });

  test('toddler: tap a friend five times, get a sticker, no microphone involved', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'toddler');
    await p.click('#photo');
    await p.click('#summon');
    await p.click('[data-screen=reveal] #go:not([disabled])');
    await expect(p.locator('#stage')).toBeVisible();
    for (let i = 0; i < 5; i++) await p.locator('#stage').click();
    await expect(p.locator('[data-screen=book] .sticker-grid > div')).toHaveCount(1, { timeout: 6000 });
    expect(await save(p, (s) => s.pals.length)).toBe(1);
    expect(await p.evaluate(() => (window as any).__voice.starts)).toBe(0);
  });
});


test.describe('town map', () => {
  test('places joined by roads with names; only the neighbours of where you are light up', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await expect(p.locator('[data-screen=trek] .tnode').first()).toBeVisible();
    const n = await save(p, (s) => s.townmap.nodes.length);
    await expect(p.locator('.tnode')).toHaveCount(n);
    await expect(p.locator('.tnode[data-state=here]')).toHaveCount(1);
    expect(await p.locator('.tnode[data-state=next]').count()).toBeGreaterThanOrEqual(2);
    await expect(p.locator('.rlabel:not([hidden])').first()).toContainText(/號(道路|水路|森林小徑|山路)/);
    // a place that is not next to anywhere visited cannot be tapped into
    await p.locator('.tnode[data-state=far]:not([data-fog="1"])').first().evaluate((el) => (el as HTMLElement).click()).catch(() => {});
    expect(await save(p, (s) => s.townmap.entering)).toBeNull();
    expect(await save(p, (s) => s.townmap.at)).toBe(0);
  });

  test('clouds cover what has not been seen; the league and the neighbours are in view; the town news lifts them', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const total = await p.locator('.tnode').count();
    const hidden = () => p.locator('.tnode[data-fog="1"]').count();
    expect(await hidden()).toBeGreaterThan(total / 2);
    await expect(p.locator('.tnode[data-kind=league][data-fog="0"]')).toHaveCount(1);
    await expect(p.locator('.tnode[data-state=next]').first()).toBeVisible();
    const puffs = await p.locator('.puff').count();
    const lit = () => p.locator('.puff.gone').count();
    expect(await lit()).toBeGreaterThan(0);
    expect(await lit()).toBeLessThan(puffs / 2);
    const before = { hidden: await hidden(), lit: await lit() };
    await p.click('#svc-info');
    expect(await hidden()).toBeLessThan(before.hidden);
    expect(await lit()).toBeGreaterThan(before.lit);
  });

  test('walking lifts the clouds around the new place', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    // what is in view: a place next door to the new one comes out of the clouds (its own cell may already be lit)
    const lit = () => p.locator('.tnode[data-fog="0"]').count();
    const before = await lit();
    await walkToFight(p);
    await startFight(p);
    await ctl(p, (c) => { c.battle.monster.hp = 1; });
    await sayWord(game, p);
    await expect(p.locator('.victory')).toBeVisible({ timeout: 8000 });
    await p.click('[data-act=next]');
    await expect(p.locator('[data-screen=trek]')).toBeVisible();
    await expect.poll(lit).toBeGreaterThan(before);
  });

  test('the map opens on the party, zoomed in, and is never shrunk to fit', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const view = () => p.evaluate(() => {
      const box = document.querySelector('#mapscroll') as HTMLElement;
      const tm = document.querySelector('#tm') as HTMLElement;
      const me = document.querySelector('#partner') as HTMLElement;
      const b = box.getBoundingClientRect(), m = me.getBoundingClientRect();
      return { fit: box.clientWidth - 20, w: tm.offsetWidth, inside: m.x > b.x && m.x < b.right && m.y > b.y && m.y < b.bottom, mid: (m.x - b.x) / b.width };
    });
    const v = await view();
    expect(v.w).toBeGreaterThan(v.fit * 1.4); // zoomed in
    expect(v.inside).toBe(true); // the party is in view
    expect(Math.abs(v.mid - 0.5)).toBeLessThan(0.15); // and in the middle
    // zoom out as far as it goes: the map fills the width, never less
    for (let i = 0; i < 6; i++) await p.click('#zout');
    expect((await view()).w).toBe(v.fit);
    // zoom in as far as it goes
    for (let i = 0; i < 10; i++) await p.click('#zin');
    const big = await view();
    expect(big.w).toBeGreaterThan(v.fit * 2.2);
    expect(big.w).toBeLessThanOrEqual(Math.round(v.fit * 2.5));
    // ctrl + wheel zooms too
    await p.evaluate(() => (document.querySelector('#mapscroll') as HTMLElement).dispatchEvent(new WheelEvent('wheel', { deltaY: 300, ctrlKey: true, clientX: 200, clientY: 300, bubbles: true, cancelable: true })));
    expect((await view()).w).toBeLessThan(big.w);
  });

  test('a finger drags the map without tapping what it started on; the target button comes back to the party', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const scroll = () => p.evaluate(() => { const b = document.querySelector('#mapscroll') as HTMLElement; return { x: b.scrollLeft, y: b.scrollTop }; });
    const before = await scroll();
    const node = await p.locator('.tnode[data-state=next]').first().boundingBox();
    await p.mouse.move(node!.x + node!.width / 2, node!.y + node!.height / 2);
    await p.mouse.down();
    await p.mouse.move(node!.x + node!.width / 2 + 100, node!.y + node!.height / 2 + 100, { steps: 6 });
    await p.mouse.up();
    const after = await scroll();
    expect(before.x - after.x + (before.y - after.y)).toBeGreaterThan(15); // the map moved with the finger (a small map has little room to move)
    expect(await save(p, (s) => s.townmap.entering)).toBeNull(); // the drag was not a tap
    await p.click('#zme');
    await expect.poll(async () => Math.abs((await scroll()).y - before.y) + Math.abs((await scroll()).x - before.x)).toBeLessThan(8);
  });

  test('tapping a new place goes straight there and shows who lives there: no confirm step', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await expect(p.locator('#go')).toHaveCount(0);
    await p.locator('.tnode[data-state=next]').first().click();
    await expect(p.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
    const id = await save(p, (s) => s.townmap.entering);
    expect(id).not.toBeNull();
    expect(await save(p, (s) => s.townmap.foes[s.townmap.entering])).toBeGreaterThan(0);
    await expect(p.locator('[data-screen=reveal]')).toContainText(/出現了/);
  });

  test('a place already visited can be walked to from far away; only new places need a neighbour', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    // pretend the party has been along a chain of places: stand at the far end of it
    const chain = await p.evaluate(() => {
      const a = (window as any).__app;
      const m = a.save.townmap;
      const path: number[] = [m.at];
      while (path.length < 5) {
        const last = path[path.length - 1];
        const nx = m.links.map((l: number[]) => (l[0] === last ? l[1] : l[1] === last ? l[0] : -1)).find((x: number) => x >= 0 && !path.includes(x));
        if (nx === undefined) break;
        path.push(nx);
      }
      a.update((s: any) => ({ ...s, townmap: { ...m, at: path[path.length - 1], visited: [...new Set([...m.visited, ...path])], cleared: [...new Set([...m.cleared, ...path.filter((i: number) => m.nodes[i].kind !== 'town')])] } }));
      a.go('trek');
      return path;
    });
    expect(chain.length).toBeGreaterThanOrEqual(3);
    // the start is several hops away and not a neighbour of where we stand, yet one tap goes there
    await expect(p.locator('.tnode[data-state=seen]').first()).toBeVisible();
    await p.locator(`.tnode[data-id="${chain[0]}"]`).click();
    await expect.poll(() => save(p, (s) => s.townmap.at), { timeout: 8000 }).toBe(chain[0]);
    expect(await save(p, (s) => s.townmap.entering)).toBeNull();
    await expect(p.locator('[data-screen=reveal]')).toHaveCount(0);
  });

  test('backing out keeps the party where it was and the same creature waits there', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await walkToFight(p);
    const first = await save(p, (s) => ({ id: s.townmap.entering, foes: s.townmap.foes }));
    await p.click('[data-screen=reveal] .bar [data-go]');
    await expect(p.locator('[data-screen=trek]')).toBeVisible();
    expect(await save(p, (s) => ({ at: s.townmap.at, entering: s.townmap.entering }))).toEqual({ at: 0, entering: null });
    await p.locator(`.tnode[data-id="${first.id}"]`).click();
    await expect(p.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
    expect(await save(p, (s) => s.townmap.foes)).toEqual(first.foes);
  });

  test('home offers to continue the trip or start a new one (after a check)', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const first = await save(p, (s) => s.townmap.seed);
    await p.click('[data-screen=trek] .bar [data-go]');
    await expect(p.locator('[data-go=trek]')).toContainText('繼續旅程');
    await p.click('[data-act=newtrip]');
    await p.click('.modal [data-act=no]');
    expect(await save(p, (s) => s.townmap.seed)).toBe(first);
    await p.click('[data-act=newtrip]');
    await p.click('.modal [data-act=yes]');
    await expect(p.locator('[data-screen=trek]')).toBeVisible();
    expect(await save(p, (s) => s.townmap.seed)).not.toBe(first);
    await expect(p.locator('.menu [data-go=toddler]')).toHaveCount(0);
  });

  test('who turns up follows the place: its types, never the camera', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const n = await p.locator('.tnode[data-state=next]').count();
    for (let i = 0; i < Math.min(3, n); i++) {
      await p.locator('.tnode[data-state=next]').nth(i).click();
      await expect(p.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
      const types: string[] = await save(p, (s) => s.townmap.nodes[s.townmap.entering].types);
      await startFight(p);
      expect(types).toContain(await ctl(p, (c) => c.foe.type));
      await p.click('[data-act=leave]');
      await expect(p.locator('[data-screen=trek]')).toBeVisible();
    }
  });

  test('running away goes back to where the party was, and nothing else changes', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const snap = () => save(p, (s) => ({ at: s.townmap.at, cleared: s.townmap.cleared, relics: s.relics, caught: s.caught }));
    const before = await snap();
    await walkToFight(p);
    await startFight(p);
    await p.click('[data-act=leave]');
    await expect(p.locator('[data-screen=trek]')).toBeVisible();
    expect(await snap()).toEqual(before);
    expect(await save(p, (s) => s.townmap.entering)).toBeNull();
  });

  test('losing all hearts ends the fight, back where the party was, with no other cost', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const snap = () => save(p, (s) => ({ at: s.townmap.at, cleared: s.townmap.cleared, relics: s.relics, caught: s.caught }));
    const before = await snap();
    await walkToFight(p);
    await startFight(p);
    await ctl(p, (c) => { c.statusEnabled = false; c.hearts = 1; });
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await ctl(p, (c) => { c.defLeft = 0.05; });
    await expect(p.locator('[data-act=lose]')).toBeVisible({ timeout: 8000 });
    await p.click('[data-act=lose]');
    await expect(p.locator('[data-screen=trek]')).toBeVisible();
    expect(await snap()).toEqual(before);
  });

  test('hearts go down by one each time a hit gets through', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    const max = await ctl(p, (c) => c.maxHearts);
    await expect(p.locator('#hearts i.on')).toHaveCount(max);
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    await ctl(p, (c) => { c.defLeft = 0.05; });
    await expect(p.locator('#hearts i.on')).toHaveCount(max - 1, { timeout: 6000 });
  });

  test('a town: news shows the types of the places around it', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await expect(p.locator('.tnode[data-known="1"]')).toHaveCount(0);
    await p.click('#svc-info');
    expect(await p.locator('.tnode[data-known="1"]').count()).toBeGreaterThan(3);
    expect(await save(p, (s) => s.townmap.infoDone)).toEqual([0]);
    await expect(p.locator('#svc-info')).toHaveCount(0);
  });

  test('a town: the gift is a relic, once', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const t = await save(p, (s) => s.townmap.nodes.find((x: any) => x.kind === 'town' && x.gift).id);
    await p.evaluate((id) => { const a = (window as any).__app; a.update((s: any) => ({ ...s, townmap: { ...s.townmap, at: id, visited: [...s.townmap.visited, id] } })); a.go('trek'); }, t);
    await p.click('#svc-gift');
    await expect(p.locator('.modal')).toBeVisible();
    expect(await save(p, (s) => s.relics.length)).toBe(1);
    await p.click('.modal [data-close]');
    expect(await save(p, (s) => s.townmap.gifts)).toEqual([t]);
    await expect(p.locator('#svc-gift')).toHaveCount(0);
  });

  test('a town: the villager\'s quiz is three spoken words and a present for two right', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await p.click('#svc-quiz');
    await expect(p.locator('[data-screen=practice]')).toContainText('村民考考你');
    for (let i = 0; i < 3; i++) {
      await expect(p.locator('#theWord')).toBeVisible();
      const word = await p.locator('#theWord').innerText();
      await sayWord(game, p);
      if (i < 2) await expect(p.locator('#theWord')).not.toHaveText(word, { timeout: 5000 });
    }
    await expect(p.locator('[data-quiz-done]')).toBeVisible({ timeout: 5000 });
    expect(await save(p, (s) => s.townmap.quizDone)).toEqual([0]);
    expect(await save(p, (s) => s.relics.length)).toBe(1);
    await p.click('[data-quiz-done] [data-go=trek]');
    await expect(p.locator('#svc-quiz')).toHaveCount(0);
  });

  test('a gym city has a boss of its own type behind the gate', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    // a small map may have no gym city at all: draw new maps until one does
    for (let i = 0; i < 40 && !(await save(p, (s) => s.townmap.nodes.some((x: any) => x.kind === 'city'))); i++) {
      await p.evaluate(() => { const a = (window as any).__app; a.update((s: any) => ({ ...s, townmap: null })); a.go('trek'); });
    }
    const city = await save(p, (s) => { const c = s.townmap.nodes.find((x: any) => x.kind === 'city'); return { id: c.id, type: c.types[0] }; });
    await approach(p, city.id);
    await p.click('[data-screen=reveal] #go:not([disabled])');
    await p.waitForFunction(() => (window as any).__v3?.shield);
    expect(await ctl(p, (c) => c.foe.type)).toBe(city.type);
    expect(await ctl(p, (c) => c.foe.rarity)).toBeGreaterThanOrEqual(3);
  });

  test('beating the league ends the trip; the next map is a new one and the journey is logged', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const first = await save(p, (s) => ({ seed: s.townmap.seed, league: s.townmap.nodes.find((x: any) => x.kind === 'league') }));
    await approach(p, first.league.id);
    await p.click('[data-screen=reveal] #go:not([disabled])');
    await p.waitForFunction(() => (window as any).__v3?.shield);
    expect(await ctl(p, (c) => c.foe.type)).toBe(first.league.types[0]);
    expect(await ctl(p, (c) => c.foe.rarity)).toBeGreaterThanOrEqual(4);
    await ctl(p, (c) => { c.shield.layers = 0; c.battle.monster.hp = 1; });
    await p.evaluate(() => (window as any).__v3.view.setShields(0, 3));
    await playUntil(game, p, async () => (await p.locator('.victory').count()) > 0, 80);
    await p.click('[data-act=next]');
    await expect(p.locator('[data-screen=home]')).toBeVisible();
    expect(await save(p, (s) => s.treks)).toBe(1);
    expect(await save(p, (s) => s.journeys.length)).toBe(1);
    expect(await save(p, (s) => s.townmap)).toBeNull();
    await p.click('[data-go=trek]');
    expect(await save(p, (s) => s.townmap.seed)).not.toBe(first.seed);
  });
});

test.describe('party details', () => {
  test('a player can be renamed and the name sticks', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'party');
    const input = p.locator('.nameinput').first();
    await input.fill('小明');
    await input.blur();
    expect(await save(p, (s) => s.players[0].name)).toBe('小明');
    await go(p, 'party');
    await expect(p.locator('.nameinput').first()).toHaveValue('小明');
  });

  test('switching the defender gives a shield word at that player\'s own level', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => {
      const a = (window as any).__app;
      a.update((s: any) => ({ ...s, players: [{ ...s.players[0], level: 1 }, { ...s.players[0], id: 'p2', name: 'B', level: 4, progress: {} }] }));
    });
    await go(p, 'battle', { foe: MOUSE });
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.statusEnabled = false; });
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('defend');
    expect(await ctl(p, (c) => c.defWord.lv)).toBe(1);
    await p.locator('#party [data-i="1"]').click();
    await expect.poll(() => ctl(p, (c) => c.defWord.lv)).toBe(3);
    await expect(p.locator('#theWord')).toHaveText(await ctl(p, (c) => c.defWord.w));
  });

  test('a boss shield shows as rings around the creature, one per layer', async ({ game }) => {
    const p = game.page;
    await open(p);
    await go(p, 'battle', { foe: BOSS, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.shield);
    const layers = await ctl(p, (c) => c.shield.layers);
    await expect(p.locator('#foe .shield-rings i:not(.pop)')).toHaveCount(layers);
    await p.evaluate(() => (window as any).__v3.view.setShields(1, 3));
    await expect(p.locator('#foe .shield-rings i:not(.pop)')).toHaveCount(1);
    await p.evaluate(() => (window as any).__v3.view.setShields(0, 3));
    await expect(p.locator('#foe .shield-rings i:not(.pop)')).toHaveCount(0);
  });
});
