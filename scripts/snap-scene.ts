import { createRequire } from 'node:module';
import { FB } from '../src/gfx/fb';
import { C } from '../src/gfx/palette';
import { makeBackdrop, vignette, type Theme } from '../src/gfx/backdrop';
import { quantizeRGBA, analyzeScene, pickRamp } from '../src/gfx/scene';
import { generateMonster, randomSpec } from '../src/gfx/monster';
import { Rng } from '../src/util/rng';
import { initNodeText, saveSheet } from './node-gfx';

initNodeText();
const require = createRequire(import.meta.url);
const napi = require('@napi-rs/canvas') as typeof import('@napi-rs/canvas');

// synthetic "living room photo": wood floor, wall, window light, red ball
const W = 180;
const H = 390;
const c = napi.createCanvas(W, H);
const ctx = c.getContext('2d');
let g = ctx.createLinearGradient(0, 0, 0, H);
g.addColorStop(0, '#d8cdbb');
g.addColorStop(0.5, '#b9a58a');
g.addColorStop(0.5, '#8a5a35');
g.addColorStop(1, '#5e3a20');
ctx.fillStyle = g;
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#dff0ff';
ctx.fillRect(110, 40, 50, 80);
ctx.fillStyle = '#3a2a1f';
for (let i = 0; i < 14; i++) ctx.fillRect(0, H / 2 + i * 26, W, 2);
ctx.fillStyle = '#c0392b';
ctx.beginPath();
ctx.arc(70, 300, 22, 0, Math.PI * 2);
ctx.fill();
const photo = ctx.getImageData(0, 0, W, H);

const quant = quantizeRGBA(photo.data, W, H);
const analysis = analyzeScene(photo.data, W, H);
console.log('analysis', analysis.brightness.toFixed(2), analysis.saturation.toFixed(2), analysis.detail.toFixed(2));
console.log(Object.entries(analysis.weights).filter(([, v]) => v > 0.02).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' '));

const sheet: FB[] = [quant];
const rng = new Rng(5);
const bg = quant.clone();
bg.veil(0, 0, W, H, C.ink, 6);
vignette(bg);
const m = generateMonster(randomSpec(99, pickRamp(analysis, rng)));
bg.blit(m.frames.idle, 62, 110);
sheet.push(bg);

for (const t of ['meadow', 'night', 'cave', 'sunset'] as Theme[]) {
  const b = makeBackdrop(W, H, 7, t);
  const mm = generateMonster(randomSpec(300 + t.length, t === 'cave' ? 'night' : 'leaf'));
  b.blit(mm.frames.idle, 62, 110);
  sheet.push(b);
}
saveSheet(sheet, 'tmp/scenes.png', 2);
console.log('ok');
