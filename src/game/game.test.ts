import { describe, expect, it } from 'vitest';
import { Battle, monsterHp } from './battle';
import { dealCard, pickDefenseWord } from './deck';
import { newPlayer } from './model';
import { record, priority } from './progress';
import { advance, isFinished, newRun, nextRelic } from './run';
import { defaultSave, load, persist } from './save';
import { WORDS } from '../data/words';
import { Revenge } from './revenge';
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

  it('the boss will not fall until every player has acted', () => {
    const b = new Battle({ name: 'King', hp: 10, maxHp: 10, boss: true }, party);
    const r = b.attack(word(4), 'perfect');
    expect(r.killed).toBe(false);
    expect(r.held).toBe(true);
    expect(r.waitingFor).toEqual([party[1].name]);
    expect(b.monster.hp).toBe(1);
    b.select(1);
    expect(b.attacker.id).toBe(party[1].id);
    expect(b.attack(word(1), 'perfect').killed).toBe(true);
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
  it('a run has ten nodes ending in a boss', () => {
    let run = newRun(1);
    expect(run.nodes).toHaveLength(10);
    expect(run.nodes[9].type).toBe('boss');
    for (let i = 0; i < 10; i++) run = advance(run);
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
    mem.set('echoquest.v2', '{not json');
    expect(load(s).players).toHaveLength(1);
  });
});
