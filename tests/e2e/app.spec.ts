import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The Pokémon-style app (index.html). The old pixel game lives at /classic.html and has its own spec.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function open(page: Page, query = ''): Promise<void> {
  // stay offline: tiny stand-in pictures, empty font css
  await page.route(/pokeapi|githubusercontent/, (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(`/?debug${query}`);
  await page.waitForFunction(() => (window as any).__app);
}

const go = (page: Page, name: string, params?: unknown) => page.evaluate(([n, p]) => (window as any).__app.go(n, p), [name, params] as const);
const ctl = <T>(page: Page, fn: (c: any) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__v3)`) as Promise<T>;
const save = <T>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__app.save)`) as Promise<T>;

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
    for (const [btn, screen] of [['dex', 'dex'], ['practice', 'practice'], ['toddler', 'toddler'], ['party', 'party'], ['trek', 'trek']] as const) {
      await p.click(`.menu [data-go=${btn}]`);
      await expect(p.locator(`[data-screen=${screen}]`)).toBeVisible();
      await p.click('[data-screen] .bar [data-go]');
      await expect(p.locator('[data-screen=home]')).toBeVisible();
    }
  });
});

test.describe('scan and battle', () => {
  test('no camera needed: summon a creature, then fight it with spoken words', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await p.click('#go');
    await p.click('#summon');
    await expect(p.locator('[data-screen=reveal] #go')).toBeEnabled();
    await p.click('[data-screen=reveal] #go');
    await expect(p.locator('#theWord')).toBeVisible();
    const before = await ctl(p, (c) => c.battle.monster.hp);
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.battle.monster.hp)).toBeLessThan(before);
  });

  test('the camera path: shutter, colours pick a creature, reveal', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await p.click('#go');
    await p.click('#cam');
    await expect(p.locator('#shot')).toBeVisible();
    await p.click('#shot');
    await expect(p.locator('[data-screen=reveal] .swatches i').first()).toBeVisible();
    await expect(p.locator('[data-screen=reveal] #go')).toBeEnabled();
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

  test('winning adds the creature to the dex and the trek moves on', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await p.click('#go');
    await p.click('#summon');
    await p.click('[data-screen=reveal] #go:not([disabled])');
    await p.waitForFunction(() => (window as any).__v3?.battle);
    await ctl(p, (c) => { c.battle.monster.hp = 1; });
    await sayWord(game, p);
    await expect(p.locator('.victory')).toBeVisible({ timeout: 8000 });
    await expect(p.locator('.newmon')).toBeVisible();
    expect(await save(p, (s) => s.caught.length)).toBe(1);
    expect(await save(p, (s) => s.run.idx)).toBe(1);
    await p.click('[data-act=next]');
    await expect(p.locator('[data-screen=trek] .node.done')).toHaveCount(1);
  });
});

test.describe('co-op boss', () => {
  test('a solo player goes through launch, rescue (three layers) and the finisher', async ({ game }) => {
    const p = game.page;
    await open(p);
    // a rare creature (5 shield layers → capped by BossFight)
    await go(p, 'battle', { foe: { id: 150, name: '超夢', type: 'psychic', rarity: 5, colors: ['#B8A8C8'] }, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.boss);
    await expect(p.locator('#shields')).toBeVisible();
    const layers = await ctl(p, (c) => c.boss.maxLayers);
    expect(layers).toBeGreaterThanOrEqual(3);
    // launch
    await expect(p.locator('.panel .hint')).toContainText('超級咒語');
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.boss.stage), { timeout: 8000 }).toBe('rescue');
    await expect(p.locator('#theWord')).toBeVisible({ timeout: 8000 });
    // rescue: every success strips a layer
    for (let i = 0; i < layers; i++) {
      await expect(p.locator('#theWord')).toBeVisible({ timeout: 8000 });
      await expect.poll(() => ctl(p, (c) => c.phase)).toBe('speak');
      await sayWord(game, p);
      await expect.poll(() => ctl(p, (c) => c.boss.layers), { timeout: 8000 }).toBe(layers - 1 - i);
    }
    await expect.poll(() => ctl(p, (c) => c.boss.stage)).toBe('finish');
    await expect(p.locator('.panel .hint')).toContainText('最後一擊', { timeout: 8000 });
    await expect.poll(() => ctl(p, (c) => c.phase)).toBe('speak');
    await sayWord(game, p);
    await expect(p.locator('.victory')).toBeVisible({ timeout: 10000 });
  });

  test('with two players only the right one may act at each stage', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, players: [s.players[0], { ...s.players[0], id: 'p2', name: 'B' }] })));
    await go(p, 'battle', { foe: { id: 150, name: '超夢', type: 'psychic', rarity: 5, colors: ['#B8A8C8'] }, boss: true });
    await p.waitForFunction(() => (window as any).__v3?.boss);
    await sayWord(game, p);
    await expect.poll(() => ctl(p, (c) => c.boss.stage), { timeout: 8000 }).toBe('rescue');
    await expect.poll(() => ctl(p, (c) => c.phase), { timeout: 8000 }).toBe('speak');
    // the bounced player rests; the other one is up
    expect(await ctl(p, (c) => c.battle.turn)).toBe(1);
    await expect(p.locator('.pbtn.locked')).toHaveCount(1);
    await expect(p.locator('.pbtn.down')).toHaveCount(1);
  });
});

test.describe('dex and party', () => {
  test('the dex marks caught creatures and a caught one can become the partner', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.evaluate(() => (window as any).__app.update((s: any) => ({ ...s, caught: [6, 25] })));
    await go(p, 'dex');
    await expect(p.locator('.bar h1')).toContainText('2 /');
    await expect(p.locator('.dexcell:not(.unknown)')).toHaveCount(2);
    await p.click('.dexcell[data-id="6"]');
    await p.click('[data-seat="0"]');
    expect(await save(p, (s) => s.players[0].mon)).toBe(6);
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
    await p.click('.menu [data-go=toddler]');
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
