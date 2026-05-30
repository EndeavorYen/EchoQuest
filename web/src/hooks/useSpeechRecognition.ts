import { useCallback, useEffect, useRef, useState } from 'react';

// Speech Recognition Hook
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: ((event?: Event) => void) | null;
  onend: ((event?: Event) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
  }) => void) | null;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionResult {
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  start: (lang?: string) => void;
  stop: () => void;
  resetTranscript: () => void;
}

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  autoRestart?: boolean;
}

const UNSUPPORTED_ERROR_MESSAGE = 'Speech recognition is not supported in this browser.';

export function useSpeechRecognition({
  onResult,
  autoRestart = false,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const manualStopRef = useRef(false);
  const langRef = useRef('en-US');
  const onResultRef = useRef(onResult);
  const autoRestartRef = useRef(autoRestart);

  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  });

  const detachHandlers = useCallback((recognition: BrowserSpeechRecognition) => {
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    manualStopRef.current = true;
    listeningRef.current = false;
    try {
      recognition.stop();
    } catch {
      recognition.abort?.();
    }
  }, []);

  const start = useCallback((lang: string = 'en-US') => {
    langRef.current = lang;
    manualStopRef.current = false;

    if (!isSupported) {
      setError(UNSUPPORTED_ERROR_MESSAGE);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(UNSUPPORTED_ERROR_MESSAGE);
      return;
    }

    if (listeningRef.current) {
      if (recognitionRef.current && recognitionRef.current.lang !== lang) {
        recognitionRef.current.stop();
      }
      return;
    }

    const newRecognition = recognitionRef.current ?? new SpeechRecognition();
    newRecognition.continuous = true; // Process multiple results
    newRecognition.lang = langRef.current;
    newRecognition.interimResults = true; // Get results as the user speaks
    if ('maxAlternatives' in newRecognition) {
      newRecognition.maxAlternatives = 1;
    }

    newRecognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
      setError(null);
      setTranscript('');
      setInterimTranscript('');
    };

    newRecognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      setInterimTranscript('');
      if (autoRestartRef.current && !manualStopRef.current && recognitionRef.current === newRecognition) {
        newRecognition.lang = langRef.current;
        try {
          newRecognition.start();
          listeningRef.current = true;
          setListening(true);
        } catch (err) {
          const domError = err as DOMException;
          if (domError?.name !== 'InvalidStateError') {
            setError(domError?.message || 'Failed to restart speech recognition.');
          }
        }
      }
    };

    newRecognition.onerror = (event) => {
      manualStopRef.current = true;
      listeningRef.current = false;
      setListening(false);
      setInterimTranscript('');
      setError(event.error || 'unknown-error');
    };

    newRecognition.onresult = (event) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const value = result?.[0]?.transcript ?? '';

        if (result?.isFinal) {
          finalTranscript += value;
        } else {
          interim += value;
        }
      }

      if (finalTranscript) {
        const normalized = finalTranscript.trim();
        setTranscript((prev) => `${prev} ${normalized}`.trim());
        onResultRef.current?.(normalized);
      }
      setInterimTranscript(interim);
    };

    recognitionRef.current = newRecognition;

    try {
      newRecognition.start();
    } catch (err) {
      const domError = err as DOMException;
      if (domError?.name !== 'InvalidStateError') {
        setError(domError?.message || 'Failed to start speech recognition.');
      }
    }
  }, [isSupported]);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    autoRestartRef.current = autoRestart;
  }, [autoRestart]);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        return;
      }

      detachHandlers(recognition);
      try {
        recognition.stop();
      } catch {
        recognition.abort?.();
      }
      recognitionRef.current = null;
      listeningRef.current = false;
    };
  }, [detachHandlers]);

  return { listening, transcript, interimTranscript, isSupported, error, start, stop, resetTranscript };
}
