import { test, expect } from './fixtures';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The Pokémon-style battle lives on its own page (battle.html); the old game is untouched.
test.describe('new battle screen', () => {
  test.beforeEach(async ({ game }) => {
    // keep the test offline: tiny stand-in pictures and empty fonts
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await game.page.route(/pokeapi|githubusercontent/, (r) => r.fulfill({ contentType: 'image/png', body: png }));
    await game.page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await game.page.goto('/battle.html?debug&mon=19');
    await game.page.waitForFunction(() => (window as any).__v3?.battle);
  });

  test('shows the wild creature, the partner and a word', async ({ game }) => {
    const p = game.page;
    await expect(p.locator('#foeName')).toHaveText('小拉達');
    await expect(p.locator('#meName')).not.toBeEmpty();
    await expect(p.locator('#theWord')).not.toBeEmpty();
  });

  test('saying the word hurts the wild creature', async ({ game }) => {
    const p = game.page;
    const word = await p.locator('#theWord').innerText();
    const before = await p.evaluate(() => (window as any).__v3.battle.monster.hp);
    await game.say(word);
    await p.click('[data-act=mic]');
    await expect.poll(() => p.evaluate(() => (window as any).__v3.battle.monster.hp)).toBeLessThan(before);
  });

  test('three misses end the turn and the word comes back later; confirm button counts as a hit', async ({ game }) => {
    const p = game.page;
    await game.say('zzzz', 'zzzz', 'zzzz');
    for (let i = 0; i < 2; i++) {
      await p.click('[data-act=mic]');
      await expect(p.locator('#note')).toContainText('再試一次');
    }
    const before = await p.evaluate(() => (window as any).__v3.battle.monster.hp);
    await expect(p.locator('[data-act=ok]')).toBeVisible();
    await p.click('[data-act=ok]');
    await expect.poll(() => p.evaluate(() => (window as any).__v3.battle.monster.hp)).toBeLessThan(before);
  });

  test('defeating it shows the victory card', async ({ game }) => {
    const p = game.page;
    await p.evaluate(() => { (window as any).__v3.battle.monster.hp = 1; });
    const word = await p.locator('#theWord').innerText();
    await game.say(word);
    await p.click('[data-act=mic]');
    await expect(p.locator('.victory')).toBeVisible({ timeout: 8000 });
    await p.click('[data-act=next]');
    await expect(p.locator('#theWord')).toBeVisible();
  });
});
