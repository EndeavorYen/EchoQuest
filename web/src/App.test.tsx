import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { Level } from './data/levels';
import { VocabItem } from './components/VocabManager';

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
        jest.spyOn(global.Math, 'random').mockRestore();
        uninstallSpeechRecognitionMock();
    });

  it('should render the main menu by default', () => {
    render(<App />);
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
    expect(screen.getByText('⚔️')).toBeInTheDocument();
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
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

    fireEvent.change(input, { target: { value: 'sword' } });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(screen.getByText(/太棒了!/)).toBeInTheDocument();
    });
    expect(screen.getByText('分數: 20')).toBeInTheDocument();
    expect(screen.getByText(/對怪物造成 2 點傷害!/)).toBeInTheDocument();
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
      expect(screen.getByText('再試一次!')).toBeInTheDocument();
    });
    expect(screen.getByText('分數: 0')).toBeInTheDocument();
  });

  it('should skip to the next word when "Skip word" is clicked', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });

    const skipButton = screen.getByRole('button', { name: /skip word/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(screen.getByText('🛡️')).toBeInTheDocument();
    });
  });

  it('should show a hint when the hint button is held down', async () => {
    render(<App initialVocab={defaultTestVocab} />);
    fireEvent.click(screen.getByText('開始遊戲'));
    await waitFor(() => {
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });

    const hintButton = screen.getByRole('button', { name: /show hint/i });
    fireEvent.mouseDown(hintButton);

    await waitFor(() => {
        expect(screen.getByText('sword')).toBeInTheDocument();
    });

    fireEvent.mouseUp(hintButton);

    await waitFor(() => {
        expect(screen.queryByText('sword')).not.toBeInTheDocument();
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
      expect(screen.getByText('勝利！')).toBeInTheDocument();
    }, { timeout: 2000 });
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

  it('shows a user-facing speech recognition error and switches to spelling mode', async () => {
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
      expect(screen.getByText('Speech recognition error: network')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
  });

  it('allows retrying voice mode after a transient speech recognition error', async () => {
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
      expect(screen.getByText('Speech recognition error: network')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('輸入英文單字')).toBeInTheDocument();
    });

    const voiceModeButton = screen.getByRole('button', { name: /切換到語音模式/i });
    expect(voiceModeButton).not.toBeDisabled();

    fireEvent.click(voiceModeButton);

    await waitFor(() => {
      expect(screen.getByText('點擊說話')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('點擊說話'));
    expect(recognition.start).toHaveBeenCalledTimes(2);

    act(() => {
      recognition.onstart?.();
    });

    await waitFor(() => {
      expect(screen.queryByText('Speech recognition error: network')).not.toBeInTheDocument();
    });
  });

  it('submits final speech recognition results immediately while still listening', async () => {
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
        results: [{ isFinal: true, 0: { transcript: 'sword' } }],
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/太棒了! 對怪物造成 2 點傷害!/)).toBeInTheDocument();
    });
    expect(screen.getByText('聆聽中...')).toBeInTheDocument();
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
