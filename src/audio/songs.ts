/**
 * Background music, all original and written as plain note strings so they are easy to
 * read and to test. One step is an eighth note. Lead / bass are note names ("C5", "F#4",
 * "Bb2"), "." is a rest and "-" holds the previous note one more step. Drums use
 * k (kick) s (snare) h (hat) and ".".
 */

export type Step = number | null;
/** -1 in a lead / bass line means "keep holding the last note". */
export const HOLD = -1;

export type Hit = 'k' | 's' | 'h' | null;

export interface Song {
  bpm: number;
  lead: Step[];
  bass: Step[];
  drums?: Hit[];
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C5" -> 72. Throws on anything it does not understand, so a typo fails a test. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note: ${name}`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function parseNotes(src: string): Step[] {
  return src.trim().split(/\s+/).map((t) => (t === '.' ? null : t === '-' ? HOLD : noteToMidi(t)));
}

export function parseDrums(src: string): Hit[] {
  return src.trim().split(/\s+/).map((t) => {
    if (t === '.') return null;
    if (t === 'k' || t === 's' || t === 'h') return t;
    throw new Error(`bad drum: ${t}`);
  });
}

const song = (bpm: number, lead: string, bass: string, drums?: string): Song => ({
  bpm,
  lead: parseNotes(lead),
  bass: parseNotes(bass),
  ...(drums ? { drums: parseDrums(drums) } : {}),
});

export const SONGS = {
  // ---- map and town --------------------------------------------------------
  /** home screen and towns: calm and open (the original tune, kept as it was) */
  map: {
    bpm: 104,
    lead: [
      72, null, 76, null, 79, null, 76, null, 81, null, 79, null, 76, 74, null, null,
      72, null, 76, null, 79, null, 84, null, 83, null, 79, null, 76, 74, 72, null,
    ],
    bass: [
      48, null, 55, null, 48, null, 55, null, 45, null, 52, null, 45, null, 52, null,
      41, null, 48, null, 41, null, 48, null, 43, null, 50, null, 43, null, 50, null,
    ],
  } as Song,
  /** roads, forests and lakes: bright and walking-paced */
  field: song(
    118,
    [
      'E5 - G5 - E5 D5 C5 -', 'D5 - G5 - B4 - D5 -', 'C5 - E5 - A5 - G5 E5', 'F5 - A5 - G5 F5 E5 -',
      'G5 - E5 - C5 - E5 G5', 'B5 - A5 G5 - D5 - .', 'A5 - G5 - F5 E5 D5 C5', 'D5 - E5 D5 B4 - G4 -',
    ].join(' '),
    [
      'C3 . G3 . C3 . G3 .', 'G2 . D3 . G2 . D3 .', 'A2 . E3 . A2 . E3 .', 'F2 . C3 . F2 . C3 .',
      'C3 . G3 . C3 . G3 .', 'G2 . D3 . G2 . D3 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . B2 .',
    ].join(' '),
    Array(8).fill('k . h . s . h .').join(' '),
  ),
  /** the second outdoor tune, so a long walk does not loop one song */
  trail: song(
    124,
    [
      'F#5 - A5 - F#5 E5 D5 -', 'E5 - A5 - C#5 - E5 -', 'D5 - F#5 - B5 - A5 F#5', 'G5 - B5 - A5 G5 F#5 -',
      'A5 - F#5 - D5 - F#5 A5', 'C#6 - B5 - A5 - E5 -', 'B5 - A5 - G5 F#5 E5 D5', 'E5 - F#5 E5 C#5 - A4 -',
    ].join(' '),
    [
      'D3 . A3 . D3 . A3 .', 'A2 . E3 . A2 . E3 .', 'B2 . F#3 . B2 . F#3 .', 'G2 . D3 . G2 . D3 .',
      'D3 . A3 . D3 . A3 .', 'A2 . E3 . A2 . E3 .', 'G2 . D3 . G2 . D3 .', 'A2 . E3 . A2 . C#3 .',
    ].join(' '),
    Array(8).fill('k . h h s . h .').join(' '),
  ),
  /** caves and mountain roads: slow, sparse, a little eerie */
  cave: song(
    84,
    [
      'A4 - - - C5 - E5 -', 'D5 - - - C5 - - -', 'A4 - - - C5 - F5 -', 'E5 - - - G#4 - B4 -',
      'C5 - E5 - A5 - - -', 'F5 - - - D5 - A4 -', 'G#4 - B4 - E5 - D5 B4', 'A4 - - - - - - -',
    ].join(' '),
    [
      'A2 . . . A2 . E2 .', 'A2 . . . A2 . E2 .', 'F2 . . . F2 . C3 .', 'E2 . . . E2 . B2 .',
      'A2 . . . A2 . E2 .', 'D2 . . . D2 . A2 .', 'E2 . . . E2 . B2 .', 'A2 . . . . . . .',
    ].join(' '),
  ),

  // ---- battle ---------------------------------------------------------------
  /** an ordinary wild creature: quick and bouncy (the earlier tune was too slow and plodding) */
  battle: song(
    172,
    [
      'G5 B5 D6 . B5 G5 D5 .', 'F#5 A5 D6 . A5 F#5 D5 .', 'E5 G5 B5 . G5 E5 B4 .', 'C6 B5 A5 G5 E5 . G5 .',
      'G5 B5 D6 G6 . D6 B5 .', 'A5 D6 F#6 . D6 A5 F#5 .', 'E6 . D6 C6 B5 . A5 .', 'A5 C#6 D6 . F#6 D6 A5 .',
    ].join(' '),
    [
      'G2 . G3 . G2 . G3 G2', 'D3 . D2 . D3 . D2 D3', 'E2 . E3 . E2 . E3 E2', 'C3 . C2 . C3 . C2 C3',
      'G2 . G3 . G2 . G3 G2', 'D3 . D2 . D3 . D2 D3', 'C3 . C2 . C3 . C2 C3', 'D3 . D2 . D3 . D2 D3',
    ].join(' '),
    Array(8).fill('k . h h s . h h').join(' '),
  ),
  /** a gym leader: tenser, minor, a driving bass */
  gym: song(
    184,
    [
      'D5 D5 F5 D5 A5 - G5 F5', 'D5 D5 F5 D5 Bb5 - A5 G5', 'E5 E5 G5 E5 C6 - Bb5 A5', 'C#5 C#5 E5 C#5 A5 - G5 E5',
      'F5 F5 A5 F5 D6 - C6 A5', 'D6 D6 C6 Bb5 A5 - G5 F5', 'E5 G5 C6 G5 E6 - D6 C6', 'C#6 B5 A5 G5 E5 - A4 -',
    ].join(' '),
    [
      'D2 D2 D3 D2 D2 D2 D3 D2', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1', 'C2 C2 C3 C2 C2 C2 C3 C2', 'A1 A1 A2 A1 A1 A1 A2 A1',
      'D2 D2 D3 D2 D2 D2 D3 D2', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1', 'C2 C2 C3 C2 C2 C2 C3 C2', 'A1 A1 A2 A1 A1 A1 A2 A1',
    ].join(' '),
    Array(8).fill('k h s h k h s h').join(' '),
  ),
  /** the champion: the fastest and most urgent */
  final: song(
    204,
    [
      'E5 G5 B5 G5 E5 G5 B5 E6', 'C5 E5 G5 E5 C5 E5 G5 C6', 'D5 F#5 A5 F#5 D5 F#5 A5 D6', 'B4 D#5 F#5 D#5 B4 D#5 F#5 B5',
      'B5 - E6 - G6 - E6 B5', 'G5 - C6 - E6 - C6 G5', 'A5 - D6 - F#6 - D6 A5', 'D#6 F#6 B6 - A6 F#6 D#6 B5',
    ].join(' '),
    [
      'E2 E2 E3 E2 E2 E2 E3 E2', 'C2 C2 C3 C2 C2 C2 C3 C2', 'D2 D2 D3 D2 D2 D2 D3 D2', 'B1 B1 B2 B1 B1 B1 B2 B1',
      'E2 E2 E3 E2 E2 E2 E3 E2', 'C2 C2 C3 C2 C2 C2 C3 C2', 'D2 D2 D3 D2 D2 D2 D3 D2', 'B1 B1 B2 B1 B1 B1 B2 B1',
    ].join(' '),
    Array(8).fill('k h s h k k s h').join(' '),
  ),
} satisfies Record<string, Song>;

export type SongName = keyof typeof SONGS;

/** Where the party is, as far as music cares. */
export type Scene = 'town' | 'outdoors' | 'cave';

const OUTDOORS: SongName[] = ['field', 'trail'];

/** The map track for a scene. Outdoors alternates between two tunes on each visit. */
export function mapTrack(scene: Scene, visit = 0): SongName {
  if (scene === 'cave') return 'cave';
  if (scene === 'town') return 'map';
  return OUTDOORS[Math.abs(visit) % OUTDOORS.length];
}

/** Which battle tune: ordinary, gym leader or the final champion. */
export function battleTrack(boss: boolean, final: boolean): SongName {
  return final ? 'final' : boss ? 'gym' : 'battle';
}
