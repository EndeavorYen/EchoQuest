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
  const MOUSE = { id: 19, name: '小拉達', type: 'normal', rarity: 1, colors: ['#A179B1'] };

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
