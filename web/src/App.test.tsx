import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import type { Level } from './data/levels';
import type { VocabItem } from './types/vocab';

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 0;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

function installSpeechRecognitionMock() {
  MockSpeechRecognition.instances = [];
  (global as any).SpeechRecognition = MockSpeechRecognition;
  (global as any).webkitSpeechRecognition = MockSpeechRecognition;
  (window as any).SpeechRecognition = MockSpeechRecognition;
  (window as any).webkitSpeechRecognition = MockSpeechRecognition;
}

function uninstallSpeechRecognitionMock() {
  delete (global as any).SpeechRecognition;
  delete (global as any).webkitSpeechRecognition;
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
}

installSpeechRecognitionMock();

// Mock the event types if they are used in a way that Jest can't resolve
if (typeof (global as any).SpeechRecognitionEvent === 'undefined') {
  (global as any).SpeechRecognitionEvent = class SpeechRecognitionEvent extends Event {
    constructor(type: string, options: any) {
      super(type, options);
      // You might need to initialize properties based on options
    }
  };
}

if (typeof (global as any).SpeechRecognitionErrorEvent === 'undefined') {
    (global as any).SpeechRecognitionErrorEvent = class SpeechRecognitionErrorEvent extends Event {
        constructor(type: string, options: any) {
            super(type, options);
             // You might need to initialize properties based on options
        }
    };
}

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Default vocab for tests that don't need a specific setup
const defaultTestVocab: VocabItem[] = [
    { id: '1', word: 'apple', difficulty: 1, enabled: true, imageName: '🍎', size: 1, type: 'image/png' },
    { id: '2', word: 'sword', difficulty: 2, enabled: true, imageName: '⚔️', size: 1, type: 'image/png' },
    { id: '3', word: 'shield', difficulty: 3, enabled: true, imageName: '🛡️', size: 1, type: 'image/png' },
];


describe('<App />', () => {
    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
        installSpeechRecognitionMock();
        let callCount = 0;
        jest.spyOn(global.Math, 'random').mockImplementation(() => {
            callCount++;
            return (callCount * 0.37) % 1;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        uninstallSpeechRecognitionMock();
    });

  it('should render the main menu by default', () => {
    render(<App />);
    const menu = screen.getByRole('main', { name: 'EchoQuest 主選單' });

    expect(menu).toHaveAttribute('data-screen', 'menu');
    expect(screen.getByText('EchoQuest')).toBeInTheDocument();
    expect(screen.getByText('開始遊戲')).toBeInTheDocument();
    expect(screen.getByText('字彙管理')).toBeInTheDocument();
  });

  it('should start the game when "開始遊戲" is clicked', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
        expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });
    expect(screen.getByRole('main', { name: 'EchoQuest 遊戲進行中' })).toHaveAttribute('data-screen', 'playing');
    expect(screen.getByText('🍎')).toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
  });

  it('lets toddler players answer by choosing a picture', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.change(screen.getByLabelText('Select learner profile'), { target: { value: 'toddler' } });
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('找一樣的圖片')).toBeInTheDocument();
    });
    expect(screen.queryByText('點擊說話')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '選擇 apple' }));

    await waitFor(() => {
      expect(screen.getByText(/太棒了!/)).toBeInTheDocument();
    });
    expect(screen.getByText('分數: 10')).toBeInTheDocument();
  });

  it('uses gentler encounter copy for toddler players', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.change(screen.getByLabelText('Select learner profile'), { target: { value: 'toddler' } });
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('小龍準備吹熱風，找對圖片就會停下來。')).toBeInTheDocument();
    });
    expect(screen.queryByText('Dragon is charging flame. Correct answers interrupt the cast.')).not.toBeInTheDocument();
  });

  it('uses tactical encounter copy for adult players', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.change(screen.getByLabelText('Select learner profile'), { target: { value: 'adult' } });
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('Dragon is charging flame. Correct answers interrupt the cast.')).toBeInTheDocument();
    });
  });

  it('shows a first-letter typing hint for kid spelling practice', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));

    expect(screen.getByText('提示：a____')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
  });

  it('renders bundled artwork for the level and current word when provided', async () => {
    const artworkLevels = [
      {
        id: 1,
        name: 'Goal Boss',
        type: 'boss',
        enemyLives: 2,
        description: 'Test generated artwork',
        imageEmoji: 'G',
        imageSrc: 'assets/generated/boss-dragon.png',
        requiredWords: 1,
      },
    ] as Level[];
    const artworkVocab = [
      {
        id: 'apple',
        word: 'apple',
        difficulty: 1,
        enabled: true,
        imageName: '🍎',
        imageSrc: 'assets/generated/word-apple.png',
        size: 1,
        type: 'image/png',
      },
    ] as VocabItem[];

    render(<App initialVocab={artworkVocab} initialLevels={artworkLevels} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Goal Boss artwork' })).toHaveAttribute('src', 'assets/generated/boss-dragon.png');
    });
    expect(screen.getByRole('img', { name: 'apple' })).toHaveAttribute('src', 'assets/generated/word-apple.png');
  });

  it('hydrates stored default vocabulary with bundled artwork', async () => {
    localStorageMock.setItem('echoquest_vocab_v1', JSON.stringify([
      { id: 'd1-1', word: 'apple', difficulty: 1, enabled: true, imageName: '🍎', size: 0, type: '' },
    ]));

    render(<App />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'apple' })).toHaveAttribute('src', 'assets/generated/word-apple.png');
    });
  });

  it('shows a visible boss objective based on required words', async () => {
    const objectiveLevels: Level[] = [
      { id: 1, name: 'Goal Boss', type: 'boss', enemyLives: 10, description: '', imageEmoji: 'G', requiredWords: 2 },
    ];

    render(<App initialLevels={objectiveLevels} initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('目標: 答對 0/2 個單字，或清空生命值 10/10')).toBeInTheDocument();
    });
  });

  it('keeps a constrained boss level playable when imported words are below the difficulty range', async () => {
    const constrainedLevels: Level[] = [
      {
        id: 1,
        name: 'Hard Gate',
        type: 'boss',
        enemyLives: 3,
        description: '',
        imageEmoji: 'H',
        requiredWords: 2,
        minDifficulty: 3,
        maxDifficulty: 5,
      },
      { id: 2, name: 'Skipped Gate', type: 'boss', enemyLives: 1, description: '', imageEmoji: 'S', requiredWords: 1 },
    ];
    const importedVocab: VocabItem[] = [
      { id: 'apple', word: 'apple', difficulty: 1, enabled: true, imageName: '🍎', size: 1, type: 'image/png' },
    ];

    render(<App initialLevels={constrainedLevels} initialVocab={importedVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('🍎')).toBeInTheDocument();
    });
    expect(screen.getByText('Hard Gate')).toBeInTheDocument();
    expect(screen.queryByText('Skipped Gate')).not.toBeInTheDocument();
  });

  it('advances a boss level after meeting requiredWords even when enemy lives remain', async () => {
    jest.useFakeTimers();
    const goalLevels: Level[] = [
      { id: 1, name: 'Word Goal', type: 'boss', enemyLives: 10, description: '', imageEmoji: 'W', requiredWords: 1 },
      { id: 2, name: 'Next Goal', type: 'boss', enemyLives: 1, description: '', imageEmoji: 'N', requiredWords: 1 },
    ];
    const goalVocab: VocabItem[] = [
      { id: '1', word: 'apple', difficulty: 1, enabled: true, imageName: '🍎', size: 1, type: 'image/png' },
    ];

    render(<App initialLevels={goalLevels} initialVocab={goalVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('Word Goal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));
    fireEvent.change(screen.getByPlaceholderText('輸入英文單字'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('攻擊!'));

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Next Goal')).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it('should handle a correct text input answer', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    const voiceModeButton = screen.getByRole('button', { name: /切換到拼字模式/i });
    fireEvent.click(voiceModeButton);

    const input = screen.getByPlaceholderText('輸入英文單字');
    const attackButton = screen.getByText('攻擊!');

    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(screen.getByText(/太棒了!/)).toBeInTheDocument();
    });
    expect(document.querySelector('[data-feedback-kind="correct"]')).toBeInTheDocument();
    expect(screen.getByText('分數: 10')).toBeInTheDocument();
    expect(screen.getByText(/對怪物造成 1 點傷害!/)).toBeInTheDocument();
    expect(screen.getByText('目標: 答對 1/5 個單字，或清空生命值 4/5')).toBeInTheDocument();
  });

  it('should handle an incorrect text input answer', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    const voiceModeButton = screen.getByRole('button', { name: /切換到拼字模式/i });
    fireEvent.click(voiceModeButton);

    const input = screen.getByPlaceholderText('輸入英文單字');
    const attackButton = screen.getByText('攻擊!');

    fireEvent.change(input, { target: { value: 'wronganswer' } });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(screen.getByText('再試一次! 連擊歸零，但不扣分。')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-feedback-kind="incorrect"]')).toBeInTheDocument();
    expect(screen.getByText('你輸入「wronganswer」，目標是 apple')).toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
  });

  it('persists a miss after an incorrect spelling answer', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));
    fireEvent.change(screen.getByPlaceholderText('輸入英文單字'), { target: { value: 'wronganswer' } });
    fireEvent.click(screen.getByText('攻擊!'));

    await waitFor(() => {
      const storedProgress = JSON.parse(localStorageMock.getItem('echoquest_progress_v1') || '{}');
      expect(storedProgress['1']).toMatchObject({
        wordId: '1',
        word: 'apple',
        attempts: 1,
        correct: 0,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastMode: 'spelling',
        dueAt: 1_700_000_000_000,
      });
    });
    expect(localStorageMock.getItem('echoquest_vocab_v1')).toBeNull();
    nowSpy.mockRestore();
  });

  it('persists a correct spelling answer', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));
    fireEvent.change(screen.getByPlaceholderText('輸入英文單字'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('攻擊!'));

    await waitFor(() => {
      const storedProgress = JSON.parse(localStorageMock.getItem('echoquest_progress_v1') || '{}');
      expect(storedProgress['1']).toMatchObject({
        wordId: '1',
        word: 'apple',
        attempts: 1,
        correct: 1,
        misses: 0,
        streak: 1,
        mastery: 1,
        lastMode: 'spelling',
      });
    });
    nowSpy.mockRestore();
  });

  it('prioritizes a due weak word when selecting the next challenge', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    localStorageMock.setItem('echoquest_progress_v1', JSON.stringify({
      '1': {
        wordId: '1',
        word: 'apple',
        attempts: 4,
        correct: 4,
        misses: 0,
        streak: 4,
        mastery: 3,
        lastPracticedAt: 1_699_999_999_000,
        lastMissedAt: null,
        lastMode: 'spelling',
        dueAt: 1_700_086_400_000,
      },
      '2': {
        wordId: '2',
        word: 'sword',
        attempts: 1,
        correct: 0,
        misses: 1,
        streak: 0,
        mastery: 0,
        lastPracticedAt: 1_699_999_999_000,
        lastMissedAt: 1_699_999_999_000,
        lastMode: 'voice',
        dueAt: 1_700_000_000_000,
      },
    }));

    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });
    expect(screen.queryByText('🍎')).not.toBeInTheDocument();
    nowSpy.mockRestore();
  });

  it('should skip to the next word when "Skip word" is clicked', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('🍎')).toBeInTheDocument();
    });

    const skipButton = screen.getByRole('button', { name: /skip word/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });
    expect(screen.getByText('已跳過這題：扣 5 分並失去連擊。')).toBeInTheDocument();
    expect(screen.getByText('跳過 1 次')).toBeInTheDocument();
  });

  it('should show a hint when the hint button is held down', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('🍎')).toBeInTheDocument();
    });

    const hintButton = screen.getByRole('button', { name: /show hint/i });
    fireEvent.mouseDown(hintButton);

    await waitFor(() => {
        expect(screen.getByText('apple')).toBeInTheDocument();
    });

    fireEvent.mouseUp(hintButton);

    await waitFor(() => {
        expect(screen.queryByText('apple')).not.toBeInTheDocument();
    });
  });

  it('should show a message if trying to start with no enabled words', async () => {
    const noEnabledVocab: VocabItem[] = [{ id: '1', word: 'apple', difficulty: 1, enabled: false, imageName: '🍎', size: 1, type: 'image/png' }];
    render(<App initialVocab={noEnabledVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('請先到字彙管理新增單字!')).toBeInTheDocument();
    });

    expect(screen.getByText('EchoQuest')).toBeInTheDocument();
  });

  it('should show the victory screen after defeating the final boss', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const victoryLevels: Level[] = [{ id: 1, name: 'Test Boss', type: 'boss', enemyLives: 1, description: '', imageEmoji: 'T', requiredWords: 1 }];
    const victoryVocab: VocabItem[] = [{ id: '1', word: 'apple', difficulty: 1, enabled: true, imageName: '🍎', size: 1, type: 'image/png' }];

    render(<App initialLevels={victoryLevels} initialVocab={victoryVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
        expect(screen.getByText('Test Boss')).toBeInTheDocument();
    });

    const voiceModeButton = screen.getByRole('button', { name: /切換到拼字模式/i });
    fireEvent.click(voiceModeButton);

    const input = screen.getByPlaceholderText('輸入英文單字');
    const attackButton = screen.getByText('攻擊!');

    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(document.querySelector('[data-feedback-kind="levelComplete"]')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('勝利！')).toBeInTheDocument();
    }, { timeout: 2000 });
    expect(screen.getByRole('main', { name: 'EchoQuest 勝利結果' })).toHaveAttribute('data-screen', 'victory');
    expect(screen.getByText('練習單字: 1')).toBeInTheDocument();
    expect(screen.getByText('精熟單字: 0')).toBeInTheDocument();
    expect(screen.getByText('待複習: 0')).toBeInTheDocument();
    nowSpy.mockRestore();
  });

  it('should handle puzzle levels correctly', async () => {
    jest.useFakeTimers();
    const puzzleVocab: VocabItem[] = [
      { id: 't1', word: 'key', difficulty: 1, enabled: true, imageName: '🔑', size: 1, type: 'image/png' },
      { id: 't2', word: 'hammer', difficulty: 2, enabled: true, imageName: '🔨', size: 1, type: 'image/png' },
    ];
    const puzzleLevels: Level[] = [
        { id: 1, name: 'Puzzle Level', type: 'puzzle', description: 'Get the tools', imageEmoji: '🚪', requiredWords: 2, tools: ['key', 'hammer'] },
        { id: 2, name: 'Final Boss', type: 'boss', enemyLives: 1, description: '', requiredWords: 1, imageEmoji: 'B' }
    ];

    render(<App initialLevels={puzzleLevels} initialVocab={puzzleVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('Puzzle Level')).toBeInTheDocument();
    });

    const voiceModeButton = screen.getByRole('button', { name: /切換到拼字模式/i });
    fireEvent.click(voiceModeButton);

    const input = screen.getByPlaceholderText('輸入英文單字');
    const attackButton = screen.getByText('攻擊!');

    // Answer 'key'
    fireEvent.change(input, { target: { value: 'key' } });
    fireEvent.click(attackButton);
    await waitFor(() => {
        expect(screen.getByText(/獲得了 key!/)).toBeInTheDocument();
    });

    act(() => {
        jest.advanceTimersByTime(1500);
    });

    // Answer 'hammer'
    fireEvent.change(input, { target: { value: 'hammer' } });
    fireEvent.click(attackButton);
    await waitFor(() => {
        expect(screen.getByText(/獲得了 hammer!/)).toBeInTheDocument();
    });

    // Advance time just enough for the level transition
    act(() => {
        jest.advanceTimersByTime(1500);
    });

    await waitFor(() => {
        expect(screen.getByText(/謎題解開! 進入下一關!/)).toBeInTheDocument();
    });

    await waitFor(() => {
        expect(screen.getByText('Final Boss')).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it('falls back to spelling mode when speech recognition is unsupported', async () => {
    uninstallSpeechRecognitionMock();

    render(<App initialVocab={defaultTestVocab} />);

    expect(screen.getByText('Speech recognition is not supported in this browser.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
    });
    expect(screen.getByText('攻擊!')).toBeInTheDocument();
  });

  it('keeps transient speech recognition errors in voice mode with a retry action', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onerror?.({ error: 'network' });
    });

    await waitFor(() => {
      expect(screen.getByText('語音辨識暫時無法連線，請重試語音。')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-feedback-kind="voiceError"]')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('輸入英文單字')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /切換到拼字模式/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重試語音/i }));
    expect(recognition.start).toHaveBeenCalledTimes(2);

    act(() => {
      recognition.onstart?.();
    });

    await waitFor(() => {
      expect(screen.queryByText('語音辨識暫時無法連線，請重試語音。')).not.toBeInTheDocument();
    });
  });

  it('explains microphone permission errors without exposing raw browser codes', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onerror?.({ error: 'not-allowed' });
    });

    await waitFor(() => {
      expect(screen.getByText('麥克風權限被阻擋，已切換到拼字模式。請允許麥克風後再試。')).toBeInTheDocument();
    });
    expect(screen.queryByText('Speech recognition error: not-allowed')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
  });

  it('can still switch to spelling mode after a transient speech recognition error', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onerror?.({ error: 'network' });
    });

    await waitFor(() => {
      expect(screen.getByText('語音辨識暫時無法連線，請重試語音。')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
    });
    expect(screen.queryByText('語音辨識暫時無法連線，請重試語音。')).not.toBeInTheDocument();
  });

  it('reviews final speech recognition results before submitting them', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(screen.getByText('聽到：apple')).toBeInTheDocument();
    expect(document.querySelector('[data-feedback-kind="voiceHeard"]')).toBeInTheDocument();
    expect(screen.getByText('目標：apple')).toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
    expect(screen.queryByText(/太棒了!/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /確認送出/i }));

    await waitFor(() => {
      expect(screen.getByText(/太棒了! \+10 分，對怪物造成 1 點傷害!/)).toBeInTheDocument();
    });
    expect(screen.getByText('分數: 10')).toBeInTheDocument();
  });

  it('ignores duplicate speech results after confirming a correct voice review', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /確認送出/i }));

    await waitFor(() => {
      expect(screen.getByText('分數: 10')).toBeInTheDocument();
    });

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(screen.queryByText('聽到：apple')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /確認送出/i })).not.toBeInTheDocument();
    expect(screen.getByText('分數: 10')).toBeInTheDocument();
  });

  it('retries a pending voice review without submitting the previous result', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' sword ' } }],
      });
    });

    expect(screen.getByText('聽到：sword')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重試語音/i }));

    expect(screen.queryByText('聽到：sword')).not.toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(screen.getByText('聽到：apple')).toBeInTheDocument();
  });

  it('keeps the first pending voice review when later recognition results arrive before confirmation', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' sword ' } }],
      });
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(screen.getByText('聽到：sword')).toBeInTheDocument();
    expect(screen.queryByText('聽到：apple')).not.toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
  });

  it('clears a pending voice review when switching out of voice mode', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' sword ' } }],
      });
    });

    expect(screen.getByText('聽到：sword')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
    });

    act(() => {
      recognition.onend?.();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到語音模式/i }));

    expect(screen.getByRole('button', { name: /切換到拼字模式/i })).toBeInTheDocument();
    expect(screen.queryByText('聽到：sword')).not.toBeInTheDocument();
  });

  it('clears a pending voice review when skipping to another word', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' banana ' } }],
      });
    });

    expect(screen.getByText('聽到：banana')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /skip word/i }));

    await waitFor(() => {
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });
    expect(screen.queryByText('聽到：banana')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /確認送出/i })).not.toBeInTheDocument();
  });

  it('ignores late speech recognition results after switching to spelling mode', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));

    await waitFor(() => {
      expect(screen.getByText('關卡 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
    });

    fireEvent.click(screen.getByRole('button', { name: /切換到拼字模式/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
    });

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'sword' } }],
      });
    });

    expect(screen.queryByText(/太棒了! 對怪物造成 2 點傷害!/)).not.toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
  });
});
