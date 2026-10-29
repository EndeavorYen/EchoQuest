import { describe, expect, it } from 'vitest';
import { buildExport, commitExport, isShortSound, logHeard, pendingCount, readExportState, readLog, MAX_LOG } from './heardlog';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const NOW = new Date(2026, 9, 29, 14, 32).getTime();

describe('logging', () => {
  it('numbers records, flags short sounds and defence rounds', () => {
    const s = mem();
    logHeard({ w: 'bee', c: ['B'], r: 'confirmed', lv: 1 }, s, NOW);
    logHeard({ w: 'elephant', c: ['no speech'], r: 'none', lv: 2, defend: true }, s, NOW);
    const [a, b] = readLog(s);
    expect(a).toMatchObject({ n: 1, w: 'bee', s: 1 });
    expect(a.d).toBeUndefined();
    expect(b).toMatchObject({ n: 2, d: 1 });
    expect(b.s).toBeUndefined();
  });
  it('keeps numbering past the size cap', () => {
    const s = mem();
    for (let i = 0; i < MAX_LOG + 5; i++) logHeard({ w: 'egg', c: ['eg'], r: 'good', lv: 1 }, s, NOW);
    const log = readLog(s);
    expect(log).toHaveLength(MAX_LOG);
    expect(log.at(-1)!.n).toBe(MAX_LOG + 5);
  });
  it('what counts as a short sound', () => {
    for (const w of ['b', 'she', 'go', 'Bee'.slice(0, 2)]) expect(isShortSound(w)).toBe(true);
    expect(isShortSound('bee')).toBe(true);
    expect(isShortSound('tree')).toBe(false);
  });
});

describe('export', () => {
  const seed = (s: ReturnType<typeof mem>, n: number) => {
    for (let i = 0; i < n; i++) logHeard({ w: 'bee', c: ['B'], r: 'confirmed', lv: 1 }, s, NOW);
  };
  const rand = () => 0;

  it('stamps a header with id, number, scope, count and version', () => {
    const s = mem();
    seed(s, 3);
    const e = buildExport('new', '2.3', s, NOW, rand);
    expect(e.id).toBe('EQ-20261029-1432-AAAA');
    expect(e.number).toBe(1);
    expect(e.count).toBe(3);
    const lines = e.text.split('\n');
    expect(lines[0]).toBe('# EchoQuest 辨識回報');
    expect(lines[1]).toBe('ID: EQ-20261029-1432-AAAA');
    expect(lines[2]).toMatch(/^匯出: 第 1 次　時間: 2026-10-29 14:32 \(UTC[+-]\d/);
    expect(lines[3]).toBe('範圍: 上次匯出之後的新紀錄　筆數: 3　版本: 2.3');
    expect(lines.slice(6).map((l) => JSON.parse(l).n)).toEqual([1, 2, 3]);
  });

  it('"new" means since the last committed export; nothing is ever deleted', () => {
    const s = mem();
    seed(s, 2);
    const first = buildExport('new', '2.3', s, NOW, rand);
    expect(pendingCount(s)).toBe(2); // building alone changes nothing
    commitExport(first, s);
    expect(pendingCount(s)).toBe(0);
    expect(readExportState(s)).toEqual({ count: 1, seq: 2 });
    seed(s, 1);
    const second = buildExport('new', '2.3', s, NOW, rand);
    expect(second.number).toBe(2);
    expect(second.count).toBe(1);
    expect(JSON.parse(second.text.split('\n').at(-1)!).n).toBe(3);
    const all = buildExport('all', '2.3', s, NOW, rand);
    expect(all.count).toBe(3);
    expect(all.text).toContain('範圍: 全部紀錄');
    expect(readLog(s)).toHaveLength(3);
  });

  it('a copy that failed (never committed) loses nothing', () => {
    const s = mem();
    seed(s, 2);
    buildExport('new', '2.3', s, NOW, rand);
    const again = buildExport('new', '2.3', s, NOW, rand);
    expect(again.count).toBe(2);
    expect(again.number).toBe(1);
  });

  it('ids differ between exports', () => {
    const s = mem();
    seed(s, 1);
    let k = 0;
    const r = () => ((k += 0.13) % 1);
    expect(buildExport('all', '2.3', s, NOW, r).id).not.toBe(buildExport('all', '2.3', s, NOW, r).id);
  });

  it('survives missing or broken storage', () => {
    expect(buildExport('all', '2.3', null, NOW, rand).count).toBe(0);
    const bad = { getItem: () => '{nope', setItem: () => { throw new Error('full'); } };
    expect(() => commitExport(buildExport('all', '2.3', bad, NOW, rand), bad)).not.toThrow();
    expect(pendingCount(bad)).toBe(0);
  });
});
