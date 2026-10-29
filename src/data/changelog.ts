/**
 * What's new, written for the players (and their grown-ups): a few plain lines per version,
 * newest first, no numbers and no implementation detail. The details live in the README.
 */
export interface Release {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.4',
    date: '2026-10-29',
    title: '打贏了，把怪物收進球裡',
    items: [
      '打倒怪物後，牠會被吸進球裡，搖晃三下，「叮」一聲收服',
      '第一次收服會寫「新收服」；稀有怪是藍球，傳說怪是金球',
      '收服時手機會跟著震動（設定裡可以關掉；iPhone 沒有震動）',
    ],
  },
  {
    version: '2.3',
    date: '2026-10-29',
    title: '麥克風聽不懂不卡住、稀有怪更有氣勢',
    items: [
      '防禦時如果麥克風連續聽不懂，會直接幫你擋下來',
      '攻擊時聽不懂太多次，會出現「我念對了」和「跳過這個字」',
      '「我念對了」會記下來，之後同樣的念法就會通過',
      '設定裡可以把辨識紀錄複製給開發者，紀錄不會被清掉',
      '四星、五星的稀有怪不管在哪遇到，一定有護盾',
      '稀有怪登場有特效，有光環，攻擊也更華麗',
    ],
  },
  {
    version: '2.2',
    date: '2026-10-29',
    title: '地圖點一下就出發、戰鬥音樂更輕快',
    items: [
      '可以去的新地方會閃光、頭上有小箭頭，一眼就看得到',
      '點了就直接出發，不用再按「前往」',
      '走過的地方不管多遠，點一下就自動走回去',
      '戰鬥音樂變得更輕快、更緊張；趕路和城鎮的音樂維持悠閒',
      '單字沒有圖片時不再塞進中文，只留英文和下面的小字',
    ],
  },
  {
    version: '2.1',
    date: '2026-10-29',
    title: '城鎮地圖、新音效與圖鑑翻頁',
    items: [
      '冒險改成像寶可夢的城鎮地圖：走過道路、洞窟和城鎮，一路挑戰道館，最後打到冠軍',
      '沒去過的地方藏在烏雲裡；可以拖曳、兩指縮放，打開地圖會自動對準你的位置',
      '城鎮可以拿小禮物、撥開烏雲，還有村民考考你；每次都是新的地圖，隨時能展開新旅程',
      '法術照屬性發出不同的聲音；地圖、一般戰鬥、道館和冠軍各有自己的背景音樂',
      '圖鑑一頁一頁翻，可以左右滑動，也能只看已抓到的；點開寶可夢就看得到整個進化家族',
      '整個畫面換成粗框、彩色按鈕的新外觀，圖示也都重新畫過',
    ],
  },
  {
    version: '2.0',
    date: '2026-10-29',
    title: '全新的手機畫面',
    items: ['念英文單字打寶可夢，打贏就收進圖鑑', '可以多位小朋友輪流玩，也能慢慢練習不打怪'],
  },
];

export const LATEST = CHANGELOG[0].version;
const KEY = 'echoquest-seen-version';

/** The version the player last looked at (null if never, or if storage is unavailable). */
export function seenVersion(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markSeen(version = LATEST): void {
  try {
    localStorage.setItem(KEY, version);
  } catch {
    // a red dot that stays is not worth breaking anything over
  }
}

/** Releases newer than the one last seen; everything when nothing was ever seen. */
export function unseen(seen: string | null = seenVersion()): Release[] {
  const i = CHANGELOG.findIndex((r) => r.version === seen);
  return i < 0 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, i);
}
