import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import type { Level } from './data/levels';
import type { AdventureState, MissionEventKind } from './game/adventure';
import { STORAGE_KEY_ADVENTURE } from './persistence/adventureStorage';
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

function missionAt(kind: MissionEventKind = 'build'): AdventureState {
  const kinds: MissionEventKind[] = [kind, 'scout', 'escort'];
  return {
    version: 2,
    seed: 42,
    events: [
      ...kinds.map((eventKind, index) => ({ id: `${eventKind}-${index}`, kind: eventKind, wordId: index === 1 ? 'ball' : 'apple' })),
      {
        id: 'boss',
        kind: 'boss',
        bossTurns: [
          { intent: 'thorns', spell: 'fire', wordId: 'apple' },
          { intent: 'falling_branch', spell: 'shield', wordId: 'ball' },
          { intent: 'curse', spell: 'heal', wordId: 'apple' },
        ],
      },
    ],
    eventIndex: 0,
    bossTurn: 0,
    spellReady: false,
    completedEventIds: [],
    rescued: false,
    rewards: [],
    modesUsed: [],
    room: 'orchard',
  };
}

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

function renderGame(vocab = [apple, ball]) {
  return render(<App initialVocab={vocab} initialLevels={testLevels} />);
}

describe('EchoQuest family relay rescue', () => {
  beforeEach(() => {
    localStorage.clear();
    uninstallSpeechRecognitionMock();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers and restores a saved active build event', async () => {
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame();

    expect(screen.getByRole('dialog', { name: '繼續森林救援' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    expect(await screen.findByRole('heading', { name: '魔法建造' })).toBeInTheDocument();
    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'build');
    expect(screen.getByTestId('relay-target-word')).toHaveTextContent('apple');
  });

  it('starts a new rescue from the resume prompt', () => {
    const saved = missionAt('build');
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(saved));
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: '新的救援' }));

    expect(screen.queryByRole('dialog', { name: '繼續森林救援' })).not.toBeInTheDocument();
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!) as AdventureState;
    expect(persisted.seed).not.toBe(saved.seed);
    expect(persisted.eventIndex).toBe(0);
  });

  it('keeps the active target during a toddler to kid handoff', () => {
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    const target = screen.getByTestId('relay-target-word').textContent;
    fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));

    expect(screen.getByTestId('relay-target-word')).toHaveTextContent(target!);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!).seed).toBe(42);
  });

  it('marks a non-Boss scene complete for 600ms and advances exactly once', () => {
    jest.useFakeTimers();
    setProfile('adult');
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '施放路徑魔法' }));

    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'build');
    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-complete', 'true');
    act(() => { jest.advanceTimersByTime(599); });
    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'build');
    act(() => { jest.advanceTimersByTime(1); });
    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'scout');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!).eventIndex).toBe(1);
  });

  it('does not restart the scene timer when an answer is submitted twice', () => {
    jest.useFakeTimers();
    setProfile('adult');
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    const answer = screen.getByLabelText('Type answer');
    const submit = screen.getByRole('button', { name: '施放路徑魔法' });
    fireEvent.change(answer, { target: { value: 'apple' } });
    fireEvent.click(submit);
    act(() => { jest.advanceTimersByTime(300); });
    fireEvent.change(answer, { target: { value: 'apple' } });
    fireEvent.click(submit);
    act(() => { jest.advanceTimersByTime(300); });

    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'scout');
    act(() => { jest.advanceTimersByTime(600); });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!).eventIndex).toBe(1);
  });

  it('immediately advances a saved completed current event without replaying celebration', () => {
    const saved = missionAt('build');
    saved.completedEventIds = [saved.events[0].id];
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(saved));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-event', 'scout');
    expect(screen.getByTestId('relay-world')).toHaveAttribute('data-complete', 'false');
  });

  it('repairs unavailable mission words before offering resume', () => {
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame([ball]);
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    expect(screen.getByTestId('relay-target-word')).toHaveTextContent('ball');
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!) as AdventureState;
    expect(persisted.events[0].wordId).toBe('ball');
  });

  it('accepts only the next kid letter and clears the draft on a wrong letter', () => {
    setProfile('kid');
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(missionAt('build')));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'letter p' })[0]);
    expect(screen.getByLabelText('拼字答案')).toHaveTextContent('點字母拼單字');
    expect(screen.getByText('下一個字母：A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'letter a' }));
    expect(screen.getByLabelText('拼字答案')).toHaveTextContent('a');
    expect(screen.getByText('下一個字母：P')).toBeInTheDocument();
  });

  it('charges the Boss with an answer and keeps all spell paths playable', () => {
    setProfile('adult');
    const bossMission = missionAt('build');
    bossMission.eventIndex = 3;
    bossMission.completedEventIds = bossMission.events.slice(0, 3).map((event) => event.id);
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(bossMission));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: '魔法充能' }));
    for (const spell of ['火焰術', '守護盾', '治癒光']) {
      expect(screen.getByRole('button', { name: new RegExp(spell) })).toBeEnabled();
    }

    fireEvent.click(screen.getByRole('button', { name: /守護盾/ }));
    expect(screen.getByRole('button', { name: /火焰術/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /火焰術/ }));
    expect(screen.getByTestId('relay-target-word')).toHaveTextContent('ball');
  });

  it('wins all three Boss turns through the relay controls', () => {
    setProfile('adult');
    const bossMission = missionAt('build');
    bossMission.eventIndex = 3;
    bossMission.completedEventIds = bossMission.events.slice(0, 3).map((event) => event.id);
    localStorage.setItem(STORAGE_KEY_ADVENTURE, JSON.stringify(bossMission));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: '繼續救援' }));

    for (const [word, spell] of [['apple', '火焰術'], ['ball', '守護盾'], ['apple', '治癒光']] as const) {
      fireEvent.change(screen.getByLabelText('Type answer'), { target: { value: word } });
      fireEvent.click(screen.getByRole('button', { name: '魔法充能' }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(spell) }));
    }

    expect(screen.getByText('森林夥伴已經安全回家')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_ADVENTURE)!).rescued).toBe(true);
  });

  it('shows mic request priority, cancels a pending request, and stops on handoff', () => {
    setProfile('adult');
    installSpeechRecognitionMock();
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: '說出單字' }));
    expect(screen.getByRole('button', { name: '等待麥克風權限' })).toBeInTheDocument();
    const recognition = MockSpeechRecognition.instances[0];

    fireEvent.click(screen.getByRole('button', { name: '等待麥克風權限' }));
    expect(screen.getByRole('button', { name: '說出單字' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '說出單字' }));

    act(() => { recognition.onstart?.(); });
    expect(screen.getByRole('button', { name: '聆聽中' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '5y 單字' }));
    expect(recognition.stop).toHaveBeenCalled();
  });

  it('keeps the mission playable when speech is unsupported', () => {
    setProfile('adult');
    renderGame();

    expect(screen.getByRole('alert')).toHaveTextContent('語音暫時不可用');
    expect(screen.getByLabelText('Type answer')).toBeEnabled();
  });

  it('fails gracefully when no vocabulary is enabled', () => {
    renderGame([{ ...apple, enabled: false }]);

    expect(screen.getByTestId('relay-world')).toBeInTheDocument();
    expect(screen.getByText('需要至少一個啟用中的單字')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '開啟字庫' })[1]).toBeEnabled();
  });
});
