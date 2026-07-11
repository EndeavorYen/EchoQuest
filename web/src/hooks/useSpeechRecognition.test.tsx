import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSpeechRecognition } from './useSpeechRecognition';

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

function clearSpeechRecognition() {
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
}

function setMockSpeechRecognition() {
  MockSpeechRecognition.instances = [];
  (window as any).SpeechRecognition = MockSpeechRecognition;
  (window as any).webkitSpeechRecognition = MockSpeechRecognition;
}

function HookHarness() {
  const speech = useSpeechRecognition();

  return (
    <div>
      <div data-testid="supported">{String((speech as any).isSupported)}</div>
      <div data-testid="error">{(speech as any).error ?? ''}</div>
      <div data-testid="listening">{String(speech.listening)}</div>
      <button onClick={() => speech.start('en-US')}>start</button>
    </div>
  );
}

function ResultHarness({ onResult }: { onResult: (result: string) => void }) {
  const speech = useSpeechRecognition({ onResult });

  return (
    <div>
      <button onClick={() => speech.start('en-US')}>start</button>
      <button onClick={speech.stop}>stop</button>
    </div>
  );
}

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSpeechRecognition();
  });

  it('reports unsupported browsers and exposes a start error', () => {
    render(<HookHarness />);

    expect(screen.getByTestId('supported')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('start'));

    expect(screen.getByTestId('error')).toHaveTextContent(
      'Speech recognition is not supported in this browser.'
    );
  });

  it('stops recognition and detaches handlers when the hook unmounts', () => {
    setMockSpeechRecognition();

    const { unmount } = render(<HookHarness />);
    fireEvent.click(screen.getByText('start'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onstart?.();
    });
    expect(screen.getByTestId('listening')).toHaveTextContent('true');

    unmount();

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.onstart).toBeNull();
    expect(recognition.onend).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onresult).toBeNull();
  });

  it('sends final results to the latest onResult callback', () => {
    setMockSpeechRecognition();
    const firstResult = jest.fn();
    const latestResult = jest.fn();

    const { rerender } = render(<ResultHarness onResult={firstResult} />);
    fireEvent.click(screen.getByText('start'));
    const recognition = MockSpeechRecognition.instances[0];

    rerender(<ResultHarness onResult={latestResult} />);
    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: ' apple ' } }],
      });
    });

    expect(firstResult).not.toHaveBeenCalled();
    expect(latestResult).toHaveBeenCalledWith('apple');
  });

  it('does not restart after no-speech or after unmount', () => {
    setMockSpeechRecognition();

    const { unmount } = render(<ResultHarness onResult={jest.fn()} />);
    fireEvent.click(screen.getByText('start'));
    const recognition = MockSpeechRecognition.instances[0];

    act(() => {
      recognition.onerror?.({ error: 'no-speech' });
    });
    expect(recognition.start).toHaveBeenCalledTimes(1);
    const ended = recognition.onend;
    unmount();
    act(() => {
      ended?.();
    });
    expect(recognition.start).toHaveBeenCalledTimes(1);
  });

  it('ignores a final result produced after stop', () => {
    setMockSpeechRecognition();
    const onResult = jest.fn();
    render(<ResultHarness onResult={onResult} />);
    fireEvent.click(screen.getByText('start'));
    const recognition = MockSpeechRecognition.instances[0];
    fireEvent.click(screen.getByText('stop'));
    act(() => recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'apple' } }],
    }));
    expect(onResult).not.toHaveBeenCalled();
  });
});
