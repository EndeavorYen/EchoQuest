import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Pack, PackWord } from '../../src/data/bank';

export const root = (p: string): string => fileURLToPath(new URL(`../../${p}`, import.meta.url));
export const packPath = (id: string): string => root(`src/data/packs/${id}.json`);

/** Where each generated pack comes from and why we may ship it. */
export const PACK_META: Record<string, Omit<Pack, 'words' | 'id'>> = {
  cefrj: {
    name: 'CEFR-J Wordlist v1.5',
    license:
      'CEFR-J Wordlist Version 1.5, Tono Laboratory, Tokyo University of Foreign Studies (compiled by Yukio Tono; copyright Tono Laboratory, TUFS; free for research and commercial use if properly cited). Source: https://github.com/openlanguageprofiles/olp-en-cefrj . Only the English headwords and CEFR levels come from it; Chinese meanings, topics, icons and game levels are our own.',
    lists: ['cefrj'],
  },
  moe1200: {
    name: '教育部國中小基本英語字彙 1200 字',
    license: '教育部公布之課程綱要附錄字表（法規命令/公文，著作權法第 9 條不為著作權之標的）。僅取英文單字本身，中文解釋與其餘欄位為自編。',
    lists: ['moe1200'],
  },
};

const ORDER: (keyof PackWord)[] = ['w', 'pos', 'zh', 'lv', 'topic', 'icon', 'cefr', 'heard', 'lists', 'retired', 'replacedBy'];

export function readPack(id: string): Pack {
  if (existsSync(packPath(id))) return JSON.parse(readFileSync(packPath(id), 'utf8')) as Pack;
  const meta = PACK_META[id];
  if (!meta) throw new Error(`unknown pack "${id}" (add it to PACK_META in scripts/lib/packfile.ts)`);
  return { id, ...meta, words: [] };
}

/** One word per line: diffs stay readable and a 8,000-word pack stays small. */
export function writePack(pack: Pack): void {
  const head = JSON.stringify({ id: pack.id, name: pack.name, license: pack.license, lists: pack.lists }, null, 1).replace(/\n}$/, ',\n"words": [');
  const lines = pack.words.map((w) => {
    const o: Record<string, unknown> = {};
    for (const k of ORDER) if (w[k] !== undefined) o[k] = w[k];
    return ' ' + JSON.stringify(o);
  });
  writeFileSync(packPath(pack.id), `${head}\n${lines.join(',\n')}\n]}\n`);
}
