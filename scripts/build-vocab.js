#!/usr/bin/env node
/*
  Scans EchoQuest/pics and generates EchoQuest/vocab.json
  Rules:
  - Word = image filename (lowercased, without extension)
  - Level = extracted from immediate parent folder numeric prefix (e.g., 001-basic => 1)
  - Supports: png, jpg, jpeg, gif, webp, svg
*/

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const PICS_DIR = path.join(BASE_DIR, 'pics');
const OUT_FILE = path.join(BASE_DIR, 'vocab.json');
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }
}

function readDirRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(readDirRecursive(p));
    else files.push(p);
  }
  return files;
}

function extractLevelFromFolder(folderName) {
  const m = /^\s*(\d{1,3})/.exec(folderName);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function main() {
  ensureDirExists(PICS_DIR);
  const files = readDirRecursive(PICS_DIR)
    .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()));

  const items = files.map((abs) => {
    const rel = path.relative(BASE_DIR, abs).replace(/\\/g, '/');
    const folder = path.basename(path.dirname(abs));
    const level = extractLevelFromFolder(folder);
    const base = path.basename(abs, path.extname(abs));
    const word = base.toLowerCase();
    const id = `${folder}/${base}`;
    return { id, word, image: `pics/${folder}/${path.basename(abs)}`, level };
  });

  items.sort((a, b) => a.level - b.level || a.word.localeCompare(b.word));

  fs.writeFileSync(OUT_FILE, JSON.stringify(items, null, 2));
  console.log(`Generated ${OUT_FILE} with ${items.length} items.`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}


