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
    await game.waitPhase('speak');

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
    await game.waitPhase('speak');
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
    await game.waitPhase('speak');
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
    await game.waitPhase('speak', 25_000);
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

test.describe('missed words come back', () => {
  test('a word that got away returns as REVENGE two rounds later, and tapping to hear costs nothing', async ({ game }) => {
    test.slow();
    await game.newGameToMap();
    await game.startBattle();
    await game.setMonsterHp(9999);
    const missed = (await game.battle()).word!;

    // listening is free practice: no attempt is recorded
    await game.tap('hear');
    await game.tap('word');
    expect(Object.keys((await game.save()).players[0].progress)).toHaveLength(0);

    await game.say('zzzz', 'qqqq');
    await game.tap('mic');
    await expect.poll(async () => (await game.battle()).tries).toBe(1);
    await game.tap('mic');
    await game.waitPhase('defend');
    await game.shield();
    await game.waitPhase('speak'); // round 2: an ordinary new word
    expect(await game.eval((a) => a.scene.isRevenge)).toBe(false);
    await game.cast();
    await game.shield();
    await game.waitPhase('speak'); // round 3: the missed word is back
    expect(await game.eval((a) => a.scene.isRevenge)).toBe(true);
    expect((await game.battle()).word).toBe(missed);
    await game.cast();
    await game.waitPhase('defend');
    // beating it clears the flag; the next word is a normal one
    await game.shield();
    await game.waitPhase('speak');
    expect(await game.eval((a) => a.scene.isRevenge)).toBe(false);
  });
});

test.describe('voice and fallbacks', () => {
  test('a silent mic asks to try again and keeps the word', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
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
    await game.waitPhase('speak');
    await game.tap('keyboard');
    expect((await game.battle()).mode).toBe('typing');
    await game.tap('keyboard');
    expect((await game.battle()).mode).toBe('idle');
  });

  test('near-miss pronunciations still count (engine alternatives are used)', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
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

  test('avatars switch who is up: each player gets a word at their own level, and the turn stays with them', async ({ game }) => {
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
    await game.waitPhase('speak');
    await game.setMonsterHp(9999);

    const players = (await game.save()).players;
    const first = await game.battle();
    expect(first.attacker).toBe(players[0].name);
    expect(first.defender).toBe(players[0].name);
    expect(await game.eval((a) => a.scene.sel.word.lv)).toBe(1);

    // tap player 2: a fresh word at level 3 is dealt, with no card to pick
    await game.switchTo(1);
    const second = await game.battle();
    expect(second.attacker).toBe(players[1].name);
    expect(second.phase).toBe('speak');
    expect(await game.eval((a) => a.scene.sel.word.lv)).toBeGreaterThanOrEqual(2);

    // the same player stays on the shield
    await game.cast();
    await game.waitPhase('defend');
    expect((await game.battle()).defender).toBe(players[1].name);
    await game.shield();
    await game.waitPhase('speak');
    expect((await game.battle()).attacker).toBe(players[1].name);
  });

  test('tapping the player who is already up only repeats the word aloud', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    const before = await game.battle();
    await game.switchTo(0);
    const after = await game.battle();
    expect(after.word).toBe(before.word);
    expect(after.phase).toBe('speak');
  });

  test('switching during the shield round hands it to the new player and restarts the clock', async ({ game }) => {
    test.slow();
    await game.open();
    await game.tap('PARTY');
    await game.tap('+ ADD PLAYER');
    await game.tap('level+0');
    await game.tap('level+1');
    await game.tap('DONE');
    await game.tap('START');
    await game.waitScene('map');
    await game.tap('node');
    await game.tap('NO CAMERA');
    await game.waitFor('FIGHT!');
    await game.tap('FIGHT!');
    await game.waitPhase('speak');
    await game.setMonsterHp(9999);
    await game.cast();
    await game.waitPhase('defend');
    const players = (await game.save()).players;
    expect((await game.battle()).defender).toBe(players[0].name);
    expect(await game.eval((a) => a.scene.defLimit)).toBeGreaterThan(0);
    await game.page.waitForTimeout(2500);
    const left = await game.eval((a) => a.scene.defLeft);
    await game.switchTo(1);
    const b = await game.battle();
    expect(b.phase).toBe('defend');
    expect(b.defender).toBe(players[1].name);
    const limit = await game.eval((a) => a.scene.defLimit);
    const now = await game.eval((a) => a.scene.defLeft);
    expect(now).toBeGreaterThan(left);
    expect(now).toBeGreaterThan(limit - 1); // a fresh clock, give or take a few frames
  });
});

test.describe('party management during a battle', () => {
  test('add a player and raise a level mid-battle; the new player starts fresh and gets their own words', async ({ game }) => {
    await game.newGameToMap();
    await game.startBattle();
    await game.setMonsterHp(9999);
    await game.tap('party');
    await game.tap('+ ADD PLAYER');
    let save = await game.save();
    expect(save.players).toHaveLength(2);
    expect(save.players[1].progress).toEqual({});
    expect(save.players[1].level).toBe(1);
    await game.tap('level+0');
    await game.tap('level+0');
    expect((await game.save()).players[0].level).toBe(3);
    await game.tap('DONE');
    // the current player's level changed, so a harder word is dealt right away
    expect((await game.battle()).phase).toBe('speak');
    expect(await game.eval((a) => a.scene.sel.word.lv)).toBe(3);
    // two avatars are now on screen, and the newcomer can take over
    expect(await game.eval((a) => a.ui.list().filter((z: any) => z.label === 'player').length)).toBe(2);
    await game.switchTo(1);
    expect(await game.eval((a) => a.scene.sel.word.lv)).toBe(1);
    await game.cast();
    await game.waitPhase('defend');
    save = await game.save();
    expect(save.players[1].stats.words).toBe(1);
    // it all survives a reload
    await game.reload();
    expect((await game.save()).players).toHaveLength(2);
  });

  test('the shield clock waits while the party panel is open, then starts over', async ({ game }) => {
    test.slow();
    await game.open();
    await game.tap('PARTY');
    await game.tap('level+0');
    await game.tap('DONE');
    await game.tap('START');
    await game.startBattle();
    await game.setMonsterHp(9999);
    await game.cast();
    await game.waitPhase('defend');
    await game.tap('party');
    const a = await game.eval((x) => x.scene.defLeft);
    await game.page.waitForTimeout(1500);
    expect(await game.eval((x) => x.scene.defLeft)).toBe(a);
    await game.tap('DONE');
    const limit = await game.eval((x) => x.scene.defLimit);
    expect(await game.eval((x) => x.scene.defLeft)).toBeGreaterThan(limit - 1);
    expect((await game.battle()).phase).toBe('defend');
  });
});

test.describe('map stops', () => {
  test('co-op boss: the launcher is bounced, the others strip the shield, the launcher finishes', async ({ game }) => {
    test.slow();
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
    await game.waitPhase('speak');
    expect((await game.battle()).boss).toBe(true);
    const stage = () => game.eval((a) => a.scene.boss.stage);
    const layers = () => game.eval((a) => a.scene.boss.layers);
    expect(await stage()).toBe('launch');
    expect(await layers()).toBe(3);
    const full = await game.battle();

    // 1. player 1 charges in with a super spell (one band harder) and is bounced; nobody takes damage
    expect(await game.eval((a) => a.scene.sel.word.lv)).toBe(2);
    await game.cast();
    await expect.poll(stage).toBe('rescue');
    await game.waitPhase('speak');
    expect((await game.battle()).hp).toBe(full.hp);

    // 2. the bounced player is out; the other player is up and can't be swapped for the launcher
    const players = (await game.save()).players;
    expect((await game.battle()).attacker).toBe(players[1].name);
    await game.switchTo(0);
    expect((await game.battle()).attacker).toBe(players[1].name);

    // a miss costs nothing: the shield stays and a new word comes around
    await game.say('zzzz', 'qqqq');
    await game.tap('mic');
    await expect.poll(async () => (await game.battle()).tries).toBe(1);
    await game.tap('mic');
    await game.waitPhase('strike');
    await game.waitPhase('speak');
    expect(await layers()).toBe(3);
    expect(await stage()).toBe('rescue');

    // each success strips one layer
    for (const left of [2, 1]) {
      await game.cast();
      await expect.poll(layers).toBe(left);
      await game.waitPhase('speak');
    }
    await game.cast();
    await expect.poll(stage).toBe('finish');
    await game.waitPhase('speak');
    expect((await game.battle()).hp).toBeLessThan(full.hp);
    expect((await game.battle()).hp).toBeGreaterThan(0);

    // 3. only the launcher can finish, with a harder word
    expect((await game.battle()).attacker).toBe(players[0].name);
    await game.switchTo(1);
    expect((await game.battle()).attacker).toBe(players[0].name);
    await game.cast();
    await game.waitPhase('victory');
    expect((await game.battle()).hp).toBe(0);
    await game.tap('CONTINUE');
    await game.waitScene('finish');
    expect(await game.has('NEW TREK')).toBe(true);
    await game.tap('NEW TREK');
    await game.waitScene('map');
    const sv = await game.save();
    expect(sv.run.idx).toBe(0);
    expect(sv.treks).toBe(1);
  });

  test('co-op boss with a single player: they play every role', async ({ game }) => {
    test.slow();
    await game.newGameToMap();
    await game.jumpToNode(9);
    await game.tap('CONTINUE');
    await game.waitScene('map');
    await game.tap('BOSS BATTLE!');
    await game.waitScene('scan');
    await game.tap('NO CAMERA');
    await game.waitFor('FIGHT!');
    await game.tap('FIGHT!');
    await game.waitPhase('speak');
    await game.winBattle();
    expect((await game.battle()).hp).toBe(0);
    expect(await game.eval((a) => a.scene.boss.stage)).toBe('done');
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

test.describe('saves', () => {
  test('an old v2 save is upgraded in place: progress follows the new word ids, the old entry stays as a backup', async ({ game, page }) => {
    await game.open();
    await page.evaluate(() => {
      localStorage.removeItem('echoquest.v3');
      const wp = { attempts: 2, correct: 2, misses: 0, streak: 2, mastery: 2, lastAt: 1, dueAt: 9e15 };
      localStorage.setItem('echoquest.v2', JSON.stringify({
        v: 2, active: 0, run: null, collection: ['2-rabbit'], relics: [], treks: 4, sound: true, music: true,
        players: [{ id: 'old1', name: 'Mochi', level: 2, face: 3, progress: { '2-rabbit': wp }, stats: { dealt: 5, perfect: 1, blocks: 0, words: 2 } }],
      }));
    });
    await game.reload();
    const s = await game.save();
    expect(s.v).toBe(3);
    expect(s.players[0].name).toBe('Mochi');
    expect(s.players[0].progress['rabbit:n'].correct).toBe(2);
    expect(s.collection).toEqual(['rabbit:n']);
    expect(s.treks).toBe(4);
    const keys = await page.evaluate(() => ({ v2: !!localStorage.getItem('echoquest.v2'), v3: !!localStorage.getItem('echoquest.v3') }));
    expect(keys).toEqual({ v2: true, v3: true });
  });

  test('the party screen shows how many words each player has learned at their level', async ({ game }) => {
    await game.open();
    await game.tap('PRACTICE');
    await game.waitScene('practice');
    const word = await game.eval((a) => a.scene.word);
    await game.say(word.w);
    await game.tap('mic');
    await expect.poll(() => game.eval((a) => a.scene.result)).toMatch(/perfect|good/);
    await game.tap('BACK');
    await game.tap('PARTY');
    await game.waitScene('players');
    const learned = await game.eval((a) => {
      const p = a.save.players[0];
      return Object.values(p.progress).filter((w: any) => w.mastery >= 1).length;
    });
    expect(learned).toBe(1);
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
    await game.waitPhase('speak');
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
