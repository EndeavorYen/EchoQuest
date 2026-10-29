/**
 * npm run words:prompt -- <batch.json>                       prompt that fills in a batch of new words
 * npm run words:prompt -- --revise "what to change" [--topic food] [--lv 2] [--ids a:n,b:v]
 *                                                            prompt that revises existing words
 * npm run words:prompt -- --schema                           writes docs/word-bank-reply.schema.json
 * The text goes to stdout, ready to hand to the agent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_WORDS, POS_LIST, TOPICS, LEVELS } from '../src/data/bank';
import { root } from './lib/packfile';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'EchoQuest word bank agent reply',
  type: 'array',
  items: {
    type: 'object',
    required: ['w', 'pos'],
    additionalProperties: false,
    properties: {
      w: { type: 'string', description: 'the English word exactly as given in the input' },
      pos: { enum: [...POS_LIST] },
      zh: { type: 'string', maxLength: 14, description: 'Traditional Chinese (Taiwan), short everyday meaning' },
      lv: { enum: LEVELS.map((l) => l.lv) },
      topic: { enum: TOPICS.map((t) => t.id) },
      icon: { type: 'string', description: 'one emoji, only if a child would recognise it' },
      heard: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      retired: { type: 'boolean' },
      replacedBy: { type: 'string', pattern: '^.+:[a-z]+$' },
      skip: { type: 'boolean' },
      why: { type: 'string' },
    },
  },
};

if (process.argv.includes('--schema')) {
  writeFileSync(root('docs/word-bank-reply.schema.json'), JSON.stringify(schema, null, 2) + '\n');
  console.log('wrote docs/word-bank-reply.schema.json');
  process.exit(0);
}

const topics = TOPICS.map((t) => `- ${t.id} ${t.zh}：${t.about}`).join('\n');
const levels = LEVELS.map((l) => `   - ${l.lv} ${l.name}`).join('\n');

const rules = `# 背景
EchoQuest 是給約 2–6 歲幼兒與家長一起玩的英文發音遊戲。畫面顯示英文字與中文意思，系統先念英文、再念中文，孩子跟著念。你要為字庫產生或修訂單字資料。

# 規則（務必全部遵守）
1. 輸出只能是一個 JSON 陣列，不要任何說明文字、不要 Markdown 圍欄。
2. \`w\` 與 \`pos\` 必須和輸入完全一致（\`pos\`：${POS_LIST.join(' ')}）。
3. \`zh\`：台灣慣用的繁體中文短義，最多 14 字，只用中文字與必要的標點（不要拼音、英文、簡體字、中國大陸用語）。是給孩子聽的日常說法，不是字典定義。多義時取最常用的一個，需要時用「、」放最多三個。
4. \`lv\`（難度）：
${levels}
   - lv 1 是約 3–6 歲孩子最先接觸的字（身邊的人事物、顏色、數字、簡單動作與形容詞、打招呼），全庫約 300 字，寧缺勿濫，不確定就給較高的級別。
   - 有 \`lvChoices\` 時只能從裡面選。
   - 不用因為「畫不出來」降級，介系詞、抽象字照收。
5. \`topic\`：只能從下面的 id 選一個，選最貼近這個字日常用法的：
${topics}
6. \`icon\`：一個 emoji，只在孩子看得懂時給；沒有合適的就省略這個欄位，不要硬湊。
7. \`heard\`：語音辨識常把這個字聽成的文字（小寫、不可與字相同、最多 12 個）。沒把握就省略。
8. 不適合兒童的字（粗話、性、暴力、菸酒藥物的口語、縮寫符號、純專有名詞）：回 \`{"w":"…","pos":"…","skip":true,"why":"原因"}\`，其餘欄位省略。
9. 每個輸入的字都要有一筆回覆，不可多、不可少、不可改拼法。`;

const out: string[] = [rules];
const reviseText = arg('--revise');
if (reviseText) {
  const ids = arg('--ids')?.split(',');
  const topic = arg('--topic');
  const lv = arg('--lv');
  const rows = ALL_WORDS.filter((w) => !w.retired && (!ids || ids.includes(w.id)) && (!topic || w.topic === topic) && (!lv || w.lv === Number(lv)));
  out.push(
    `# 任務：修訂既有字\n修訂要求：${reviseText}\n\n下面是目前的資料。每筆只回傳**有變動**的字，內容是 \`w\`、\`pos\` 加上要改的欄位；沒有要改的字就不要回。若要退役一個字，回 \`{"w":"…","pos":"…","retired":true}\`，被別的字取代時加 \`"replacedBy":"新字:pos"\`。上面第 9 條在這個任務中不適用。`,
    `# 目前資料（${rows.length} 筆）\n` + rows.map((w) => JSON.stringify({ w: w.w, pos: w.pos, zh: w.zh, lv: w.lv, topic: w.topic, icon: w.icon, cefr: w.cefr })).join('\n'),
  );
} else {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) { console.error('usage: words:prompt <batch.json> | --revise "…" | --schema'); process.exit(1); }
  const batch = JSON.parse(readFileSync(file, 'utf8')) as { items: unknown[]; batch: number; of: number };
  out.push(
    `# 任務：為新字填資料（第 ${batch.batch}/${batch.of} 批，${batch.items.length} 字）\n每筆輸入有 \`w\`、\`pos\`、\`cefr\`（來源清單的等級，僅供判斷難度）、\`lvChoices\`、有時有 \`alt\`（其他拼法，忽略即可）。請回傳陣列，每筆含 \`w\` \`pos\` \`zh\` \`lv\` \`topic\`，有圖才加 \`icon\`，有把握才加 \`heard\`。`,
    `# 輸入\n` + batch.items.map((i) => JSON.stringify(i)).join('\n'),
  );
}
console.log(out.join('\n\n'));
