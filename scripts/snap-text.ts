import { FB } from '../src/gfx/fb';
import { C } from '../src/gfx/palette';
import { drawText, title } from '../src/gfx/text';
import { initNodeText, savePNG } from './node-gfx';

initNodeText();
const fb = new FB(180, 120);
fb.clear(C.dusk);
title(fb, 'EchoQuest', 90, 6, C.sun, 2);
drawText(fb, 'Say the spell, beat it!', 8, 34, C.snow);
drawText(fb, '說出咒語，打敗怪物！', 8, 50, C.ice, { shadow: C.ink });
drawText(fb, 'apple 蘋果  elephant 大象', 8, 66, C.lime);
drawText(fb, 'PERFECT x3 COMBO', 90, 84, C.orange, { align: 'center', outline: C.ink });
drawText(fb, '單字 level 1 幼兒園', 8, 100, C.mist);
savePNG(fb, 'tmp/text.png', 4);
console.log('ok');
