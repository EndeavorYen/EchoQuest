import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  onstart: ((event?: Event) => void) | null = null;
  onend: ((event?: Event) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

const apple: VocabItem = {
  id: 'apple',
  word: 'apple',
  imageName: 'apple',
  imageSrc: 'assets/generated/word-apple.png',
  difficulty: 1,
  enabled: true,
  size: 0,
  type: '',
};

const ball: VocabItem = {
  ...apple,
  id: 'ball',
  word: 'ball',
  imageName: 'ball',
  imageSrc: 'assets/generated/word-ball.png',
};

const cat: VocabItem = {
  ...apple,
  id: 'cat',
  word: 'cat',
  imageName: 'cat',
  imageSrc: 'assets/generated/word-cat.png',
};

const testLevels: Level[] = [{
  id: 1,
  name: 'Training Gate',
  type: 'boss',
  description: 'One answer clears the level.',
  imageEmoji: 'gate',
  requiredWords: 1,
  enemyLives: 1,
  minDifficulty: 1,
  maxDifficulty: 1,
}];

const testVocab = [apple];

function setProfile(profile: 'toddler' | 'kid' | 'adult') {
  localStorage.setItem('echoquest_profile_v1', profile);
}

function installSpeechRecognitionMock() {
  MockSpeechRecognition.instances = [];
  (window as any).SpeechRecognition = MockSpeechRecognition;
  (window as any).webkitSpeechRecognition = MockSpeechRecognition;
}

function uninstallSpeechRecognitionMock() {
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
}

function renderGame() {
  return render(<App initialVocab={testVocab} initialLevels={testLevels} />);
}

async function expectRoom(name: string) {
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
}

describe('EchoQuest arcade game', () => {
  beforeEach(() => {
    localStorage.clear();
    uninstallSpeechRecognitionMock();
    jest.clearAllMocks();
  });

  it('lets the family finish orchard, bridge, and rescue rooms together', async () => {
    render(<App initialVocab={testVocab} initialLevels={testLevels} />);

    expect(screen.getByRole('heading', { name: '果園探索' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /選擇 apple/i }));

    expect(screen.getByRole('heading', { name: '修復魔法橋' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));
    for (const letter of ['a', 'p', 'p', 'l', 'e']) {
      const tile = screen.getAllByRole('button', { name: `letter ${letter}` })
        .find((button) => !(button as HTMLButtonElement).disabled);
      fireEvent.click(tile!);
    }
    fireEvent.click(screen.getByRole('button', { name: '修好橋梁' }));

    expect(screen.getByRole('heading', { name: '森林救援' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '成人/家長' }));
    for (const spell of ['火球', '護盾', '治療']) {
      fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: 'apple' } });
      fireEvent.click(screen.getByRole('button', { name: '魔法充能' }));
      fireEvent.click(screen.getByRole('button', { name: spell }));
    }
    expect(screen.getByRole('heading', { name: '救援成功' })).toBeInTheDocument();
  });

  it('keeps a rescue charge after a wrong spell and consumes it after the correct spell', () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /選擇 apple/i }));
    fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));
    for (const letter of ['a', 'p', 'p', 'l', 'e']) {
      const tile = screen.getAllByRole('button', { name: `letter ${letter}` })
        .find((button) => !(button as HTMLButtonElement).disabled);
      fireEvent.click(tile!);
    }
    fireEvent.click(screen.getByRole('button', { name: '修好橋梁' }));
    fireEvent.click(screen.getByRole('button', { name: '成人/家長' }));

    const spells = ['火球', '護盾', '治療'];
    for (const spell of spells) {
      expect(screen.getByRole('button', { name: spell })).toBeDisabled();
    }

    fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '魔法充能' }));
    for (const spell of spells) {
      expect(screen.getByRole('button', { name: spell })).toBeEnabled();
    }

    fireEvent.click(screen.getByRole('button', { name: '護盾' }));
    expect(screen.getByRole('heading', { name: '森林救援' })).toBeInTheDocument();
    for (const spell of spells) {
      expect(screen.getByRole('button', { name: spell })).toBeEnabled();
    }

    fireEvent.click(screen.getByRole('button', { name: '火球' }));
    for (const spell of spells) {
      expect(screen.getByRole('button', { name: spell })).toBeDisabled();
    }
  });

  it('starts toddler rounds with two choices and allows a wrong tap before the match', async () => {
    setProfile('toddler');
    const { container } = render(<App initialVocab={[apple, ball, cat]} initialLevels={testLevels} />);

    const targetWord = container.querySelector('.eq-target-card img')?.getAttribute('alt');
    expect(targetWord).toBeTruthy();

    const choiceButtons = await screen.findAllByRole('button', { name: /選擇/i });
    expect(choiceButtons).toHaveLength(2);

    const wrongChoice = choiceButtons.find((button) => !button.getAttribute('aria-label')?.includes(targetWord!));
    expect(wrongChoice).toBeTruthy();
    fireEvent.click(wrongChoice!);
    expect(await screen.findByText(/再找一次/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`選擇 ${targetWord}`, 'i') }));

    await expectRoom('修復魔法橋');
  });

  it('lets a kid assemble letters before attacking', async () => {
    setProfile('kid');
    renderGame();

    for (const letter of ['a', 'p', 'p', 'l', 'e']) {
      await screen.findAllByRole('button', { name: `letter ${letter}` });
      const nextTile = screen
        .getAllByRole('button', { name: `letter ${letter}` })
        .find((button) => !button.hasAttribute('disabled'));
      expect(nextTile).toBeTruthy();
      fireEvent.click(nextTile!);
    }

    expect(screen.getByLabelText('拼字答案')).toHaveTextContent('apple');
    fireEvent.click(screen.getByRole('button', { name: '完成探索' }));

    await expectRoom('修復魔法橋');
  });

  it('clears kid letter tiles after a wrong spelling attempt', async () => {
    setProfile('kid');
    renderGame();

    fireEvent.click(await screen.findByRole('button', { name: 'letter a' }));
    expect(screen.getByLabelText('拼字答案')).toHaveTextContent('a');

    fireEvent.click(screen.getByRole('button', { name: '完成探索' }));

    expect(await screen.findByText(/還差一點/i)).toBeInTheDocument();
    expect(screen.getByLabelText('拼字答案')).toHaveTextContent('點字母拼單字');
    expect(screen.getByRole('button', { name: 'letter a' })).not.toBeDisabled();
  });

  it('lets an adult type the answer without voice', async () => {
    setProfile('adult');
    renderGame();

    fireEvent.change(await screen.findByLabelText(/type answer/i), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '完成探索' }));

    await expectRoom('修復魔法橋');
  });

  it('uses voice as an optional confirmed answer for adult mode', async () => {
    setProfile('adult');
    installSpeechRecognitionMock();
    renderGame();

    fireEvent.click(await screen.findByRole('button', { name: /說出單字/i }));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(await screen.findByText('聽到：apple')).toBeInTheDocument();
    expect(recognition.continuous).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /確認送出/i }));

    await expectRoom('修復魔法橋');
  });

  it('keeps typing playable when speech recognition is unsupported', async () => {
    setProfile('adult');
    renderGame();

    expect(await screen.findByRole('alert')).toHaveTextContent('語音暫時不可用');
    fireEvent.change(screen.getByLabelText(/type answer/i), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '完成探索' }));

    await expectRoom('修復魔法橋');
  });
});
