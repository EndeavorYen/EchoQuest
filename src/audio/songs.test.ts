import { describe, expect, it } from 'vitest';
import { HOLD, SONGS, battleTrack, mapTrack, noteToMidi, parseDrums, parseNotes, type SongName } from './songs';
import { MASTER_GAIN, MUSIC_GAIN } from './sfx';

const NAMES = Object.keys(SONGS) as SongName[];

describe('note strings', () => {
  it('reads note names', () => {
    expect(noteToMidi('C5')).toBe(72);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#4')).toBe(66);
    expect(noteToMidi('Bb2')).toBe(46);
  });
  it('reads rests and holds', () => {
    expect(parseNotes('C5 . - E5')).toEqual([72, null, HOLD, 76]);
    expect(parseDrums('k . h s')).toEqual(['k', null, 'h', 's']);
  });
  it('fails loudly on a typo', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => parseDrums('k x')).toThrow();
  });
});

describe('songs', () => {
  it('has every tune the game asks for', () => {
    for (const n of ['map', 'field', 'trail', 'cave', 'battle', 'gym', 'final'] as SongName[]) expect(NAMES).toContain(n);
  });
  it.each(NAMES)('%s: lines line up and notes are playable', (name) => {
    const s = SONGS[name];
    expect(s.lead.length).toBeGreaterThanOrEqual(32);
    expect(s.lead.length % 8).toBe(0);
    expect(s.bass.length).toBe(s.lead.length);
    if (s.drums) expect(s.drums.length).toBe(s.lead.length);
    for (const n of [...s.lead, ...s.bass]) if (n !== null && n !== HOLD) expect(n).toBeGreaterThan(24), expect(n).toBeLessThan(100);
    // a hold needs a note to hold
    for (const line of [s.lead, s.bass]) line.forEach((n, i) => { if (n === HOLD) expect(i > 0 && line[i - 1] !== null).toBe(true); });
    expect(s.lead.some((n) => typeof n === 'number' && n > 0)).toBe(true);
  });
  it('battle music is quick (the walking music is the lazy one)', () => {
    for (const n of ['battle', 'gym', 'final'] as SongName[]) expect(SONGS[n].bpm).toBeGreaterThanOrEqual(168);
    for (const n of ['map', 'field', 'trail', 'cave'] as SongName[]) expect(SONGS[n].bpm).toBeLessThanOrEqual(125);
    // the battle tune keeps moving: no long stretches of one repeated note
    const lead = SONGS.battle.lead;
    let run = 1;
    for (let i = 1; i < lead.length; i++) { run = lead[i] === lead[i - 1] ? run + 1 : 1; expect(run).toBeLessThanOrEqual(2); }
  });
  it('gets faster and busier as the stakes rise', () => {
    expect(SONGS.gym.bpm).toBeGreaterThan(SONGS.battle.bpm);
    expect(SONGS.final.bpm).toBeGreaterThan(SONGS.gym.bpm);
    expect(SONGS.cave.bpm).toBeLessThan(SONGS.map.bpm);
  });
  it('keeps the music under the effects', () => {
    expect(MUSIC_GAIN).toBeLessThan(MASTER_GAIN);
    expect(MUSIC_GAIN).toBeLessThan(0.3);
  });
});

describe('which tune plays', () => {
  it('follows the scenery', () => {
    expect(mapTrack('town')).toBe('map');
    expect(mapTrack('cave', 3)).toBe('cave');
    expect(['field', 'trail']).toContain(mapTrack('outdoors', 0));
  });
  it('rotates the outdoor tunes between visits', () => {
    expect(mapTrack('outdoors', 0)).not.toBe(mapTrack('outdoors', 1));
    expect(mapTrack('outdoors', 2)).toBe(mapTrack('outdoors', 0));
  });
  it('picks a battle tune by the foe', () => {
    expect(battleTrack(false, false)).toBe('battle');
    expect(battleTrack(true, false)).toBe('gym');
    expect(battleTrack(true, true)).toBe('final');
  });
});
