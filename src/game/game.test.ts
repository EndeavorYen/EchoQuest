import { describe, expect, it } from 'vitest';
import { Battle, monsterHp } from './battle';
import { dealCard, pickDefenseWord } from './deck';
import { newPlayer } from './model';
import { record, priority, levelStat } from './progress';
import { advance, isFinished, newRun, nextRelic } from './run';
import { defaultSave, load, persist, migrateV2 } from './save';
import { WORDS, WORD_BY_ID, buildBank, wordId, wordsInList, LEVELS, type Pack } from '../data/words';
import { Revenge } from './revenge';
import { growthSpecs, addSticker, TODDLER_TAPS, MAX_STICKERS } from './toddler';
import { randomSpec } from '../gfx/monster';
import { BossFight, BOSS_LAYERS } from './boss';
import { Rng } from '../util/rng';

const word = (lv: 1 | 2 | 3 | 4) => WORDS.find((w) => w.lv === lv)!;

describe('deck', () => {
  it('deals one word at the player level, straight away', () => {
    for (const lv of [1, 2, 3, 4] as const) {
      const c = dealCard(newPlayer(0, lv), Date.now(), new Rng(lv));
      expect(c.word.lv).toBe(lv);
    }
  });

  it('avoids repeating the words just dealt', () => {
    const p = newPlayer(0, 2);
    const recent = WORDS.filter((w) => w.lv === 2).slice(0, 5).map((w) => w.id);
    for (let s = 0; s < 20; s++) {
      expect(recent).not.toContain(dealCard(p, 0, new Rng(s), recent).word.id);
    }
  });

  it('brings back words the player missed', () => {
    const p = newPlayer(0, 2);
    const target = WORDS.filter((w) => w.lv === 2)[5];
    p.progress = record(p.progress, target.id, false, 1000);
    let seen = 0;
    for (let s = 0; s < 40; s++) {
      if (dealCard(p, 2000, new Rng(s)).word.id === target.id) seen += 1;
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('defense words are short and easy', () => {
    const p = newPlayer(0, 4);
    for (let s = 0; s < 20; s++) {
      const w = pickDefenseWord(p, 0, new Rng(s));
      expect(w.lv).toBe(3);
      expect(w.w.length).toBeLessThanOrEqual(7);
    }
  });
});

describe('revenge', () => {
  const w = WORDS[0];
  it('a missed word comes back two rounds later, for that player only', () => {
    const r = new Revenge();
    r.miss('a', w, 1);
    expect(r.take('a', 1)).toBeNull();
    expect(r.take('a', 2)).toBeNull();
    expect(r.take('b', 3)).toBeNull();
    expect(r.take('a', 3)?.id).toBe(w.id);
    expect(r.take('a', 4)).toBeNull();
  });

  it('missing it again does not duplicate it', () => {
    const r = new Revenge();
    r.miss('a', w, 1);
    r.miss('a', w, 3);
    expect(r.pending('a')).toBe(1);
    expect(r.take('a', 4)).toBeNull();
    expect(r.take('a', 5)?.id).toBe(w.id);
  });

  it('revenge hits are stronger', () => {
    const mk = () => new Battle({ name: 'x', hp: 500, maxHp: 500, boss: false }, [newPlayer(0, 2)]);
    const plain = mk().attack(word(2), 'perfect').damage;
    const sweet = mk().attack(word(2), 'perfect', 1.5).damage;
    expect(sweet).toBeGreaterThan(plain);
  });
});

describe('co-op boss', () => {
  it('goes launch → rescue (strip every layer) → finish → done', () => {
    const f = new BossFight();
    expect(f.stage).toBe('launch');
    f.launch(0);
    expect(f.stage).toBe('rescue');
    expect(f.launcher).toBe(0);
    for (let i = 0; i < BOSS_LAYERS - 1; i++) expect(f.breakLayer()).toBe(false);
    expect(f.stage).toBe('rescue');
    expect(f.breakLayer()).toBe(true);
    expect(f.stage).toBe('finish');
    f.finish();
    expect(f.stage).toBe('done');
  });

  it('each layer has its own status move, and the bounced player recovers as layers fall', () => {
    const f = new BossFight();
    f.launch(1);
    const moves = [f.move.id];
    expect(f.recovery).toBe(0);
    f.breakLayer();
    moves.push(f.move.id);
    expect(f.recovery).toBeCloseTo(1 / BOSS_LAYERS);
    f.breakLayer();
    moves.push(f.move.id);
    expect(new Set(moves).size).toBe(3);
  });

  it('kids rescue, the bounced player finishes; a solo player plays every role', () => {
    const f = new BossFight();
    expect(f.canAct(0, 2)).toBe(true);
    expect(f.canAct(1, 2)).toBe(true);
    f.launch(0);
    expect(f.canAct(0, 3)).toBe(false);
    expect(f.canAct(1, 3)).toBe(true);
    expect(f.nextActor(0, 3)).toBe(1);
    f.breakLayer(); f.breakLayer(); f.breakLayer();
    expect(f.canAct(1, 3)).toBe(false);
    expect(f.canAct(0, 3)).toBe(true);
    expect(f.nextActor(1, 3)).toBe(0);
    expect(f.canAct(0, 1)).toBe(true);
  });

  it('layers cannot be stripped before the launch, and breaking one only chips the boss', () => {
    const f = new BossFight();
    expect(f.breakLayer()).toBe(false);
    expect(f.layers).toBe(BOSS_LAYERS);
    const b = new Battle({ name: 'King', hp: 100, maxHp: 100, boss: true }, [newPlayer(0, 1)]);
    b.chip(0.1);
    expect(b.monster.hp).toBe(90);
    b.chip(5);
    expect(b.monster.hp).toBe(1);
    expect(b.finisher()).toBe(1);
    expect(b.monster.hp).toBe(0);
  });
});

describe('progress', () => {
  it('prioritises missed words over mastered ones', () => {
    let pr = record({}, 'a', false, 0);
    pr = record(pr, 'b', true, 0);
    pr = record(pr, 'b', true, 0);
    pr = record(pr, 'b', true, 0);
    expect(priority(pr, 'a', 10)).toBeLessThan(priority(pr, 'b', 10));
  });
});

describe('battle', () => {
  const party = [newPlayer(0, 2), newPlayer(1, 3)];

  it('harder words and perfect hits do more damage', () => {
    const b = new Battle({ name: 'x', hp: 500, maxHp: 500, boss: false }, party);
    const easy = b.attack(word(1), 'perfect').damage;
    const b2 = new Battle({ name: 'x', hp: 500, maxHp: 500, boss: false }, party);
    const hard = b2.attack(word(4), 'perfect').damage;
    const half = new Battle({ name: 'x', hp: 500, maxHp: 500, boss: false }, party).attack(word(4), 'good').damage;
    expect(hard).toBeGreaterThan(easy);
    expect(half).toBeLessThan(hard);
  });

  it('builds combos and resets them on a miss', () => {
    const b = new Battle({ name: 'x', hp: 500, maxHp: 500, boss: false }, party);
    const d1 = b.attack(word(2), 'perfect').damage;
    const d2 = b.attack(word(2), 'perfect').damage;
    expect(d2).toBeGreaterThan(d1);
    expect(b.attack(word(2), 'miss').combo).toBe(0);
    expect(b.combo).toBe(0);
  });

  it('a failed defence resets the combo and heals the monster a little, never hurts the player', () => {
    const b = new Battle({ name: 'x', hp: 50, maxHp: 100, boss: false }, party);
    b.attack(word(2), 'perfect');
    const hpBefore = b.monster.hp;
    const r = b.defend(false);
    expect(b.combo).toBe(0);
    expect(r.healed).toBeGreaterThan(0);
    expect(b.monster.hp).toBeGreaterThan(hpBefore);
    expect(b.monster.hp).toBeLessThanOrEqual(100);
  });

  it('a successful block reflects damage', () => {
    const b = new Battle({ name: 'x', hp: 100, maxHp: 100, boss: false }, party);
    const r = b.defend(true);
    expect(r.reflect).toBeGreaterThan(0);
    expect(b.monster.hp).toBeLessThan(100);
  });

  it('the defender is whoever is up, and switching changes both', () => {
    const b = new Battle({ name: 'x', hp: 100, maxHp: 100, boss: false }, party);
    expect(b.attacker.id).toBe(party[0].id);
    expect(b.defender.id).toBe(party[0].id);
    b.select(1);
    expect(b.attacker.id).toBe(party[1].id);
    expect(b.defender.id).toBe(party[1].id);
    b.select(5);
    expect(b.attacker.id).toBe(party[1].id);
  });

  it('single players defend for themselves', () => {
    const solo = [newPlayer(0, 1)];
    const b = new Battle({ name: 'x', hp: 100, maxHp: 100, boss: false }, solo);
    expect(b.defender.id).toBe(b.attacker.id);
  });

  it('scales monster hp with the party and the stage', () => {
    const early = monsterHp(party, 0, false);
    const late = monsterHp(party, 8, false);
    expect(late).toBeGreaterThan(early);
    expect(monsterHp(party, 9, true)).toBeGreaterThan(late);
    expect(monsterHp([newPlayer(0, 4)], 0, false)).toBeGreaterThan(monsterHp([newPlayer(0, 1)], 0, false));
  });
});

describe('run & save', () => {
  it('a run is a short walk of six stops with a chest in the middle, ending in a boss', () => {
    let run = newRun(1);
    expect(run.nodes).toHaveLength(6);
    expect(run.nodes[5].type).toBe('boss');
    expect(run.nodes.some((n) => n.type === 'chest')).toBe(true);
    expect(run.nodes.filter((n) => n.type === 'monster').length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 6; i++) run = advance(run);
    expect(isFinished(run)).toBe(true);
  });

  it('hands out new relics first', () => {
    expect(nextRelic(['key'], 0).id).not.toBe('key');
  });

  it('round-trips through storage and survives garbage', () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const save = defaultSave();
    save.players[0].level = 3;
    save.collection = ['1-cat'];
    persist(save, s);
    const back = load(s);
    expect(back.players[0].level).toBe(3);
    expect(back.collection).toEqual(['1-cat']);
    mem.set('echoquest.v3', '{not json');
    expect(load(s).players).toHaveLength(1);
  });
});

describe('word bank', () => {
  it('ids are stable and unique: word + part of speech, no level in them', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
    expect(WORD_BY_ID.get('rabbit:n')?.lv).toBe(2);
    expect(wordId(' Bank ', 'v')).toBe('bank:v');
    expect(wordId('bank', 'n')).not.toBe(wordId('bank', 'v'));
  });

  it('every difficulty band has words, and every word belongs to a list', () => {
    for (const l of LEVELS) expect(WORDS.filter((w) => w.lv === l.lv).length, `level ${l.lv}`).toBeGreaterThan(10);
    expect(WORDS.every((w) => w.lists.length > 0)).toBe(true);
    expect(wordsInList('starter').length).toBe(WORDS.length);
  });

  const pack = (id: string, words: Pack['words']): Pack => ({ id, name: id, license: 'test', lists: [id], words });

  it('one word can sit in several lists while keeping one id and one level', () => {
    const bank = buildBank([
      pack('a', [{ w: 'cat', pos: 'n', zh: '貓', lv: 1 }]),
      pack('b', [{ w: 'cat', pos: 'n', zh: '貓咪', lv: 3, lists: ['extra'] }, { w: 'cat', pos: 'v', zh: '(俚)', lv: 4 }]),
    ]);
    expect(bank).toHaveLength(2);
    const cat = bank.find((w) => w.id === 'cat:n')!;
    expect(cat.lv).toBe(1);
    expect(cat.lists).toEqual(['a', 'b', 'extra']);
  });

  it('skips broken entries instead of crashing', () => {
    const bad = [
      { w: '', pos: 'n', zh: 'x', lv: 1 },
      { w: 'ok', pos: 'n', zh: 'x', lv: 9 },
      { w: 'fine', pos: 'n', zh: 'x', lv: 2 },
      null,
    ] as unknown as Pack['words'];
    expect(buildBank([pack('p', bad)]).map((w) => w.id)).toEqual(['fine:n']);
  });
});

describe('save migration & level stats', () => {
  it('v2 saves keep their progress under the new word ids', () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const p = newPlayer(0, 2);
    p.progress = record({}, '2-rabbit', true, 5);
    mem.set('echoquest.v2', JSON.stringify({ v: 2, players: [p], active: 0, run: null, collection: ['1-cat', 'zzz-unknown'], relics: ['key'], treks: 3, sound: true, music: false }));
    const save = load(s);
    expect(save.v).toBe(3);
    expect(save.players[0].progress['rabbit:n'].correct).toBe(1);
    expect(save.players[0].progress['2-rabbit']).toBeUndefined();
    expect(save.collection).toEqual(['cat:n', 'zzz-unknown']);
    expect(save.treks).toBe(3);
    expect(save.music).toBe(false);
    // written under the v3 key, with the v2 entry left alone as a backup
    expect(JSON.parse(mem.get('echoquest.v3')!).v).toBe(3);
    expect(JSON.parse(mem.get('echoquest.v2')!).v).toBe(2);
    // and a second load reads v3 directly
    expect(load(s).collection).toEqual(['cat:n', 'zzz-unknown']);
  });

  it('migrating twice changes nothing', () => {
    const once = migrateV2({ v: 2, players: [newPlayer(0)], collection: ['1-cat'] });
    expect(migrateV2(once).collection).toEqual(['cat:n']);
  });

  it('counts seen / learned / mastered per difficulty band', () => {
    let pr = record({}, 'cat:n', true, 0);
    pr = record(pr, 'dog:n', false, 0);
    pr = record(pr, 'fish:n', true, 0);
    pr = record(pr, 'fish:n', true, 0);
    pr = record(pr, 'fish:n', true, 0);
    pr = record(pr, 'rabbit:n', true, 0);
    const st = levelStat(pr, WORDS, 1);
    expect(st.total).toBe(WORDS.filter((w) => w.lv === 1).length);
    expect(st).toMatchObject({ seen: 3, learned: 2, mastered: 1 });
    expect(levelStat(pr, WORDS, 2)).toMatchObject({ seen: 1, learned: 1, mastered: 0 });
    expect(levelStat(pr, WORDS, 4)).toMatchObject({ seen: 0, learned: 0, mastered: 0 });
  });
});

describe('toddler mode', () => {
  it('a friend changes look on every tap and ends as itself, crowned', () => {
    const spec = randomSpec(5, 'leaf');
    const looks = growthSpecs(spec);
    expect(looks).toHaveLength(TODDLER_TAPS);
    const keys = looks.map((l) => `${l.ramp}/${l.accessory}`);
    expect(new Set(keys).size).toBe(TODDLER_TAPS);
    const last = looks[TODDLER_TAPS - 1];
    expect(last.ramp).toBe('leaf');
    expect(last.accessory).toBe('crown');
    expect(last.kind).toBe(spec.kind);
    expect(last.seed).toBe(spec.seed);
  });

  it('the sticker book keeps the newest and stays small', () => {
    let book = [] as ReturnType<typeof growthSpecs>;
    for (let i = 0; i < MAX_STICKERS + 5; i++) book = addSticker(book, randomSpec(i, 'fire'));
    expect(book).toHaveLength(MAX_STICKERS);
    expect(book[0].seed).toBe(MAX_STICKERS + 4);
  });

  it('old saves without a sticker book load with an empty one', () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const save = defaultSave();
    const raw = JSON.parse(JSON.stringify(save));
    delete raw.stickers;
    mem.set('echoquest.v3', JSON.stringify(raw));
    expect(load(s).stickers).toEqual([]);
  });
});
