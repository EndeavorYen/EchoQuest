/**
 * The word bank. Plain data on purpose: to swap in an official list (教育部
 * 1200 字, 大考中心 7000 字 …) just replace or extend this array.
 *
 * lv 1 = 幼兒園   lv 2 = 國小   lv 3 = 國中   lv 4 = 高中
 * icon = an emoji that gets pixelated at runtime; leave empty for abstract words.
 */
export interface Word {
  id: string;
  w: string;
  zh: string;
  lv: 1 | 2 | 3 | 4;
  icon?: string;
}

type Row = [w: string, zh: string, icon?: string];

function level(lv: 1 | 2 | 3 | 4, rows: Row[]): Word[] {
  return rows.map(([w, zh, icon]) => ({ id: `${lv}-${w}`, w, zh, lv, icon }));
}

export const WORDS: Word[] = [
  ...level(1, [
    ['apple', '蘋果', '🍎'], ['banana', '香蕉', '🍌'], ['cat', '貓', '🐱'], ['dog', '狗', '🐶'],
    ['fish', '魚', '🐟'], ['bird', '鳥', '🐦'], ['cow', '牛', '🐮'], ['pig', '豬', '🐷'],
    ['duck', '鴨子', '🦆'], ['frog', '青蛙', '🐸'], ['sun', '太陽', '☀️'], ['moon', '月亮', '🌙'],
    ['star', '星星', '⭐'], ['tree', '樹', '🌳'], ['flower', '花', '🌸'], ['car', '汽車', '🚗'],
    ['bus', '公車', '🚌'], ['ball', '球', '⚽'], ['book', '書', '📖'], ['egg', '蛋', '🥚'],
    ['milk', '牛奶', '🥛'], ['cake', '蛋糕', '🍰'], ['hand', '手', '✋'], ['red', '紅色', '🟥'],
    ['blue', '藍色', '🟦'], ['green', '綠色', '🟩'],
  ]),
  ...level(2, [
    ['rabbit', '兔子', '🐰'], ['monkey', '猴子', '🐵'], ['tiger', '老虎', '🐯'], ['lion', '獅子', '🦁'],
    ['panda', '熊貓', '🐼'], ['horse', '馬', '🐴'], ['chicken', '雞', '🐔'], ['pizza', '披薩', '🍕'],
    ['cookie', '餅乾', '🍪'], ['school', '學校', '🏫'], ['pencil', '鉛筆', '✏️'], ['bag', '書包', '🎒'],
    ['clock', '時鐘', '⏰'], ['chair', '椅子', '🪑'], ['door', '門', '🚪'], ['bed', '床', '🛏️'],
    ['shoes', '鞋子', '👟'], ['hat', '帽子', '🎩'], ['umbrella', '雨傘', '☂️'], ['rainbow', '彩虹', '🌈'],
    ['snow', '雪', '❄️'], ['bicycle', '腳踏車', '🚲'], ['train', '火車', '🚆'], ['airplane', '飛機', '✈️'],
    ['grape', '葡萄', '🍇'], ['orange', '柳橙', '🍊'],
  ]),
  ...level(3, [
    ['elephant', '大象', '🐘'], ['giraffe', '長頸鹿', '🦒'], ['dolphin', '海豚', '🐬'], ['butterfly', '蝴蝶', '🦋'],
    ['volcano', '火山', '🌋'], ['mountain', '山', '⛰️'], ['island', '島嶼', '🏝️'], ['castle', '城堡', '🏰'],
    ['bridge', '橋', '🌉'], ['library', '圖書館', '📚'], ['hospital', '醫院', '🏥'], ['telescope', '望遠鏡', '🔭'],
    ['calendar', '日曆', '📅'], ['medicine', '藥', '💊'], ['vegetable', '蔬菜', '🥦'], ['strawberry', '草莓', '🍓'],
    ['sandwich', '三明治', '🥪'], ['battery', '電池', '🔋'], ['adventure', '冒險'], ['courage', '勇氣'],
    ['friendship', '友誼'], ['holiday', '假日'], ['popular', '受歡迎的'], ['dangerous', '危險的'],
    ['beautiful', '美麗的'], ['yesterday', '昨天'],
  ]),
  ...level(4, [
    ['environment', '環境'], ['technology', '科技'], ['opportunity', '機會'], ['responsibility', '責任'],
    ['communicate', '溝通'], ['society', '社會'], ['experience', '經驗'], ['knowledge', '知識'],
    ['development', '發展'], ['influence', '影響'], ['creative', '有創意的'], ['essential', '必要的'],
    ['anxiety', '焦慮'], ['ambitious', '有野心的'], ['sustainable', '永續的'], ['philosophy', '哲學'],
    ['architecture', '建築'], ['democracy', '民主'], ['hypothesis', '假設'], ['atmosphere', '大氣'],
    ['abandon', '放棄'], ['significant', '重要的'], ['efficient', '有效率的'], ['reluctant', '不情願的'],
    ['vocabulary', '字彙'], ['temperature', '溫度'],
  ]),
];

export const LEVELS = [
  { lv: 1, name: '幼兒園', en: 'Kinder' },
  { lv: 2, name: '國小', en: 'Primary' },
  { lv: 3, name: '國中', en: 'Junior' },
  { lv: 4, name: '高中', en: 'Senior' },
] as const;

export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export function wordsOfLevel(lv: number): Word[] {
  return WORDS.filter((w) => w.lv === lv);
}
