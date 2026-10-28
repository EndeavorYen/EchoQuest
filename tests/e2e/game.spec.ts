import { test, expect } from './fixtures';

test.describe('core loop', () => {
  test('title → map → monster → battle → victory → map advances and is saved', async ({ game }) => {
    await game.open();
    expect(await game.scene()).toBe('title');
    await game.tap('START');
    await game.waitScene('map');
    expect((await game.save()).run.idx).toBe(0);

    await game.tap('node');
    await game.waitScene('scan');
    await game.tap('NO CAMERA');
    await game.waitFor('FIGHT!');
    await game.tap('FIGHT!');
    await game.waitScene('battle');
    await game.waitPhase('pick');

    await game.setMonsterHp(20);
    await game.winBattle();
    await game.tap('CONTINUE');
    await game.waitScene('map');

    const saved = await game.save();
    expect(saved.run.idx).toBe(1);
    expect(saved.collection.length).toBeGreaterThan(0);
    expect(saved.players[0].stats.words).toBeGreaterThan(0);

    // the progress survives a reload
    await game.reload();
    expect(await game.has('CONTINUE')).toBe(true);
    await game.tap('CONTINUE');
    await game.waitScene('map');
    expect((await game.save()).run.idx).toBe(1);
  });

  test('a full battle at natural HP can be won with good answers', async ({ game }) => {
    test.slow();
    await game.newGameToMap();
    await game.startBattle();
    const start = await game.battle();
    expect(start.hp).toBe(start.maxHp);
    await game.winBattle();
    const end = await game.battle();
    expect(end.hp).toBe(0);
  });

  test('damage matches the word level, and the shield round follows every hit', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    const before = await game.battle();
    await game.cast();
    await game.waitPhase('defend');
    const after = await game.battle();
    expect(after.hp).toBeLessThan(before.hp);
    expect(after.combo).toBe(1);
    expect(after.defWord).toBeTruthy();
  });
});

test.describe('failing is safe', () => {
  test('two wrong tries fizzle: no damage, combo stays 0, then the shield round starts', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    const full = await game.battle();
    await game.tap('card');
    await game.waitPhase('speak');
    await game.say('zzzz');
    await game.tap('mic');
    await expect.poll(async () => (await game.battle()).tries).toBe(1);
    expect((await game.battle()).phase).toBe('speak');
    await game.say('qqqq');
    await game.tap('mic');
    await game.waitPhase('defend');
    const b = await game.battle();
    expect(b.hp).toBe(full.hp);
    expect(b.combo).toBe(0);
  });

  test('a failed shield resets the combo and heals the monster about 10%, but nobody is hurt', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.cast();
    await game.waitPhase('defend');
    const hit = await game.battle();
    expect(hit.hp).toBeLessThan(hit.maxHp);
    await game.say('zzzz', 'qqqq');
    await game.tap('mic');
    await expect.poll(async () => (await game.battle()).tries).toBe(1);
    await game.tap('mic');
    await game.waitPhase('resolve');
    await game.waitPhase('pick');
    const b = await game.battle();
    expect(b.combo).toBe(0);
    expect(b.hp).toBeGreaterThan(hit.hp);
    expect(b.hp).toBeLessThanOrEqual(b.maxHp);
    // there is no player health to lose
    const player = (await game.save()).players[0];
    expect(Object.keys(player)).not.toContain('hp');
  });

  test('a good shield reflects damage at the monster and raises the combo', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.cast();
    await game.waitPhase('defend');
    const hit = await game.battle();
    await game.shield();
    await game.waitPhase('pick');
    const b = await game.battle();
    expect(b.hp).toBeLessThan(hit.hp);
    expect(b.combo).toBeGreaterThanOrEqual(2);
    expect((await game.save()).players[0].stats.blocks).toBe(1);
  });
});

test.describe('shield timer', () => {
  test('from level 2 up the shield has a clock; running out lets the hit through', async ({ game }) => {
    test.slow();
    await game.open();
    await game.tap('PARTY');
    await game.tap('level+0');
    await game.tap('DONE');
    await game.waitScene('title');
    await game.tap('START');
    await game.startBattle();
    await game.cast();
    await game.waitPhase('defend');
    const hit = await game.battle();
    expect(await game.eval((a) => a.scene.defLimit)).toBeGreaterThan(0);
    // say nothing: the clock runs out by itself
    await game.waitPhase('pick', 25_000);
    const after = await game.battle();
    expect(after.combo).toBe(0);
    expect(after.hp).toBeGreaterThan(hit.hp);
  });

  test('level 1 (little kids) has no clock at all', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.cast();
    await game.waitPhase('defend');
    expect(await game.eval((a) => a.scene.defLimit)).toBe(0);
    await game.page.waitForTimeout(3000);
    expect((await game.battle()).phase).toBe('defend');
  });
});

test.describe('voice and fallbacks', () => {
  test('a silent mic asks to try again and keeps the card', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.tap('card');
    await game.waitPhase('speak');
    await game.tap('mic'); // nothing queued → "no speech"
    await expect.poll(() => game.eval((a) => a.scene.note)).toMatch(/hear/i);
    const b = await game.battle();
    expect(b.phase).toBe('speak');
    expect(b.tries).toBe(0);
  });

  test('a blocked mic falls back to typing, and typing works', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.tap('card');
    await game.waitPhase('speak');
    await game.say('!denied');
    await game.tap('mic');
    await expect.poll(() => game.eval((a) => a.scene.forceTyping)).toBe(true);
    await game.tap('mic');
    await expect.poll(async () => (await game.battle()).mode).toBe('typing');
    const word = (await game.battle()).word!;
    await game.page.keyboard.type(word);
    await game.page.keyboard.press('Enter');
    await game.waitPhase('defend');
    expect((await game.battle()).combo).toBe(1);
  });

  test('the keyboard button switches to typing on demand', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.tap('card');
    await game.waitPhase('speak');
    await game.tap('keyboard');
    expect((await game.battle()).mode).toBe('typing');
    await game.tap('keyboard');
    expect((await game.battle()).mode).toBe('idle');
  });

  test('near-miss pronunciations still count (engine alternatives are used)', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.tap('card');
    await game.waitPhase('speak');
    const word = (await game.battle()).word!;
    await game.say(['zzzz', word.toUpperCase() + '.']);
    await game.tap('mic');
    await game.waitPhase('defend');
  });
});

test.describe('party', () => {
  test('levels can be changed any time and are remembered', async ({ game }) => {
    await game.open();
    await game.tap('PARTY');
    await game.waitScene('players');
    await game.tap('level+0');
    await game.tap('level+0');
    expect((await game.save()).players[0].level).toBe(3);
    await game.tap('level-0');
    expect((await game.save()).players[0].level).toBe(2);
    await game.tap('DONE');
    await game.waitScene('title');
    await game.reload();
    expect((await game.save()).players[0].level).toBe(2);
  });

  test('two players take turns; the next one defends; each gets cards for their own level', async ({ game }) => {
    await game.open();
    await game.tap('PARTY');
    await game.tap('+ ADD PLAYER');
    expect((await game.save()).players).toHaveLength(2);
    await game.tap('level+1');
    await game.tap('level+1');
    await game.tap('DONE');
    await game.waitScene('title');
    await game.tap('START');
    await game.waitScene('map');
    await game.tap('node');
    await game.tap('NO CAMERA');
    await game.waitFor('FIGHT!');
    await game.tap('FIGHT!');
    await game.waitPhase('pick');

    const first = await game.battle();
    expect(first.attacker).not.toBe(first.defender);
    await game.setMonsterHp(9999);

    // player 1 (level 1) sees level 1–2 cards
    const lvls1 = await game.eval((a) => a.scene.cards.map((c: any) => c.word.lv));
    expect(Math.max(...lvls1)).toBeLessThanOrEqual(2);

    await game.cast();
    await game.waitPhase('defend');
    expect((await game.battle()).defender).toBe((await game.save()).players[1].name);
    await game.shield();
    await game.waitPhase('pick');

    const second = await game.battle();
    expect(second.attacker).toBe((await game.save()).players[1].name);
    const lvls2 = await game.eval((a) => a.scene.cards.map((c: any) => c.word.lv));
    expect(Math.min(...lvls2)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('map stops', () => {
  test('the boss cannot fall until everyone has acted, then the trek is cleared', async ({ game }) => {
    await game.open();
    await game.tap('PARTY');
    await game.tap('+ ADD PLAYER');
    await game.tap('DONE');
    await game.tap('START');
    await game.waitScene('map');
    await game.jumpToNode(9);
    await game.tap('CONTINUE');
    await game.waitScene('map');
    await game.tap('BOSS BATTLE!');
    await game.waitScene('scan');
    await game.tap('NO CAMERA');
    await game.waitFor('FIGHT!');
    await game.tap('FIGHT!');
    await game.waitPhase('pick');
    expect((await game.battle()).boss).toBe(true);

    await game.setMonsterHp(1);
    await game.cast();
    await game.waitPhase('defend');
    // a lethal hit was held back: the second player has not acted yet
    expect((await game.battle()).hp).toBe(1);
    expect(await game.has('CONTINUE')).toBe(false);

    await game.shield(); // the second player now acts → the reflected hit finishes it
    await game.waitPhase('victory');
    await game.tap('CONTINUE');
    await game.waitScene('finish');
    expect(await game.has('NEW TREK')).toBe(true);
    await game.tap('NEW TREK');
    await game.waitScene('map');
    const s = await game.save();
    expect(s.run.idx).toBe(0);
    expect(s.treks).toBe(1);
  });

  test('a chest gives a relic and moves on', async ({ game }) => {
    await game.newGameToMap();
    await game.jumpToNode(2);
    await game.tap('CONTINUE');
    await game.waitScene('map');
    await game.tap('OPEN CHEST');
    await game.waitScene('chest');
    await game.tap('OPEN!');
    await game.waitFor('CONTINUE');
    await game.tap('CONTINUE');
    await game.waitScene('map');
    const s = await game.save();
    expect(s.relics).toHaveLength(1);
    expect(s.run.idx).toBe(3);
  });
});

test.describe('practice mode', () => {
  test('builds mastery without touching the trek', async ({ game }) => {
    await game.open();
    await game.tap('PRACTICE');
    await game.waitScene('practice');
    const word = await game.eval((a) => a.scene.word);
    await game.say(word.w);
    await game.tap('mic');
    await expect.poll(() => game.eval((a) => a.scene.result)).toMatch(/perfect|good/);
    let s = await game.save();
    expect(s.players[0].progress[word.id]).toBeTruthy();
    expect(s.run).toBeNull();

    await game.tap('NEXT');
    await expect.poll(() => game.eval((a) => a.scene.result)).toBe('none');
    const next = await game.eval((a) => a.scene.word);
    await game.say('zzzz');
    await game.tap('mic');
    await expect.poll(() => game.eval((a) => a.scene.result)).toBe('miss');
    s = await game.save();
    expect(s.players[0].progress[next.id]).toBeTruthy();
    expect(s.run).toBeNull();
    expect(s.collection).toHaveLength(0);

    await game.tap('BACK');
    await game.waitScene('title');
  });

  test('the practice level can be changed without touching the saved level', async ({ game }) => {
    await game.open();
    await game.tap('PRACTICE');
    await game.waitScene('practice');
    await game.tap('level+');
    expect(await game.eval((a) => a.scene.lv)).toBe(2);
    expect((await game.save()).players[0].level).toBe(1);
  });
});

test.describe('camera', () => {
  test('scan with the camera: open → viewfinder → shutter → monster → fight', async ({ game }) => {
    await game.newGameToMap();
    await game.tap('node');
    await game.waitScene('scan');
    await game.tap('OPEN CAMERA');
    await game.waitFor('shutter');
    await game.tap('shutter');
    await game.waitFor('FIGHT!', 20_000);
    await game.tap('FIGHT!');
    await game.waitScene('battle');
    await game.waitPhase('pick');
  });

  test('a blocked camera offers the summon fallback', async ({ game, page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    });
    await game.newGameToMap();
    await game.tap('node');
    await game.waitScene('scan');
    await game.tap('OPEN CAMERA');
    await game.waitFor('SUMMON!');
    await game.tap('SUMMON!');
    await game.waitFor('FIGHT!');
  });
});
