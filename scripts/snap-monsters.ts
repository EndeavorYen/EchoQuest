import { FB } from '../src/gfx/fb';
import { C, RAMPS, type RampName } from '../src/gfx/palette';
import { generateMonster, randomSpec } from '../src/gfx/monster';
import { drawText } from '../src/gfx/text';
import { initNodeText, savePNG } from './node-gfx';

initNodeText();
const ramps = Object.keys(RAMPS) as RampName[];
const cols = 5;
const rows = 3;
const cell = 62;
const fb = new FB(cols * cell, rows * cell + 4);
fb.clear(C.dusk);
let i = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const ramp = ramps[i % ramps.length];
    const m = generateMonster(randomSpec(1000 + i * 37, ramp));
    fb.blit(m.frames.idle, c * cell + 3, r * cell + 3);
    i++;
  }
}
savePNG(fb, 'tmp/monsters.png', 4);

const f2 = new FB(5 * 64, 90);
f2.clear(C.navy);
const m = generateMonster(randomSpec(4242, 'leaf'));
(['idle', 'blink', 'hurt', 'open'] as const).forEach((n, k) => {
  f2.blit(m.frames[n], 4 + k * 60, 4);
  drawText(f2, n, 4 + k * 60 + 28, 66, C.snow, { align: 'center' });
});
const boss = generateMonster(randomSpec(777, 'berry', true));
f2.blit(boss.frames.idle, 4 + 4 * 60 - 8, 4);
savePNG(f2, 'tmp/frames.png', 4);
console.log('ok');
