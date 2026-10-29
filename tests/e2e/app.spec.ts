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

/** Step onto the first neighbour of the start town; the creature of that place is shown. */
async function walkToFight(page: Page): Promise<void> {
  await page.locator('.tnode[data-state=out]').first().click();
  await page.click('#go');
  await expect(page.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
}
/** From the reveal to the battle. */
async function startFight(page: Page): Promise<void> {
  await page.click('[data-screen=reveal] #go:not([disabled])');
  await page.waitForFunction(() => (window as any).__v3?.battle);
}

/** Put the party on a place next to `id`, then tap `id` and "go". */
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
  await page.click('#go');
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
    expect(await p.locator('.tnode[data-state=out]').count()).toBeGreaterThanOrEqual(2);
    await expect(p.locator('.rlabel:not([hidden])').first()).toContainText(/號(道路|水路|森林小徑|山路)/);
    // a far place is not a choice
    await p.locator('.tnode[data-state=far]').first().evaluate((el) => (el as HTMLElement).click());
    await expect(p.locator('.toast')).toContainText('太遠');
    expect(await save(p, (s) => s.townmap.entering)).toBeNull();
  });

  test('clouds cover what has not been seen; the league and the neighbours are in view; the town news lifts them', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    const total = await p.locator('.tnode').count();
    const hidden = () => p.locator('.tnode[data-fog="1"]').count();
    expect(await hidden()).toBeGreaterThan(total / 2);
    await expect(p.locator('.tnode[data-kind=league][data-fog="0"]')).toHaveCount(1);
    await expect(p.locator('.tnode[data-state=out]').first()).toBeVisible();
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
    const lit = () => p.locator('.puff.gone').count();
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
    const node = await p.locator('.tnode[data-state=out]').first().boundingBox();
    await p.mouse.move(node!.x + node!.width / 2, node!.y + node!.height / 2);
    await p.mouse.down();
    await p.mouse.move(node!.x + node!.width / 2 + 100, node!.y + node!.height / 2 + 100, { steps: 6 });
    await p.mouse.up();
    const after = await scroll();
    expect(before.x - after.x + (before.y - after.y)).toBeGreaterThan(15); // the map moved with the finger (a small map has little room to move)
    await expect(p.locator('#panel')).not.toContainText('前往'); // the drag was not a tap
    await p.click('#zme');
    await expect.poll(async () => Math.abs((await scroll()).y - before.y) + Math.abs((await scroll()).x - before.x)).toBeLessThan(8);
  });

  test('picking a place shows what it is; "go" steps there and shows who lives there', async ({ game }) => {
    const p = game.page;
    await open(p);
    await p.click('[data-go=trek]');
    await p.locator('.tnode[data-state=out]').first().click();
    await expect(p.locator('#panel')).toContainText('住著誰');
    expect(await save(p, (s) => s.townmap.entering)).toBeNull(); // picking is not going yet
    await p.click('#go');
    await expect(p.locator('[data-screen=reveal]')).toBeVisible({ timeout: 10_000 });
    const id = await save(p, (s) => s.townmap.entering);
    expect(id).not.toBeNull();
    expect(await save(p, (s) => s.townmap.foes[s.townmap.entering])).toBeGreaterThan(0);
    await expect(p.locator('[data-screen=reveal]')).toContainText(/出現了/);
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
    await p.click('#go');
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
    const n = await p.locator('.tnode[data-state=out]').count();
    for (let i = 0; i < Math.min(3, n); i++) {
      await p.locator('.tnode[data-state=out]').nth(i).click();
      await p.click('#go');
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
