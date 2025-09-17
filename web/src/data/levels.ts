export interface Level {
  id: number;
  name: string;
  type: 'boss' | 'puzzle';
  description: string;
  imageEmoji: string;
  requiredWords: number;
  enemyLives?: number;
  tools?: string[];
}

// Define default levels so they can be exported or used as a default prop
export const defaultLevels: Level[] = [
    {
      id: 1,
      name: '巨龍巢穴',
      type: 'boss',
      description: '打敗守護寶藏的巨龍！',
      imageEmoji: '🐉',
      requiredWords: 5,
      enemyLives: 5
    },
    {
      id: 2,
      name: '哥布林洞穴',
      type: 'boss',
      description: '一隻討厭的哥布林擋住了去路！',
      imageEmoji: '👺',
      requiredWords: 5,
      enemyLives: 3
    },
    {
      id: 3,
      name: '石像巨人山脈',
      type: 'boss',
      description: '巨大的石像巨人覺醒了！',
      imageEmoji: '🗿',
      requiredWords: 5,
      enemyLives: 8
    },
    {
      id: 4,
      name: '魔王城堡',
      type: 'boss',
      description: '最終挑戰：擊敗魔王！',
      imageEmoji: '👿',
      requiredWords: 5,
      enemyLives: 12
    },
    {
      id: 5,
      name: '魔法之門',
      type: 'puzzle',
      description: '收集三個魔法工具來開啟大門！',
      imageEmoji: '🚪✨',
      requiredWords: 3,
      tools: ['key', 'hammer', 'magic'] // These should map to words in vocab
    }
];
