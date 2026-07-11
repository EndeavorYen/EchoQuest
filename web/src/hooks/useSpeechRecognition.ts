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
  requestingPermission: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  start: (lang?: string) => void;
  stop: () => void;
  resetTranscript: () => void;
  clearError: () => void;
}

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
}

const UNSUPPORTED_ERROR_MESSAGE = 'Speech recognition is not supported in this browser.';

export function useSpeechRecognition({
  onResult,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const langRef = useRef('en-US');
  const onResultRef = useRef(onResult);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    listeningRef.current = false;
    setRequestingPermission(false);
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    try {
      recognition.stop();
    } catch {
      recognition.abort?.();
    }
  }, []);

  const start = useCallback((lang: string = 'en-US') => {
    langRef.current = lang;

    if (!isSupported) {
      setRequestingPermission(false);
      setError(UNSUPPORTED_ERROR_MESSAGE);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRequestingPermission(false);
      setError(UNSUPPORTED_ERROR_MESSAGE);
      return;
    }

    if (activeRef.current) {
      if (recognitionRef.current && recognitionRef.current.lang !== lang) {
        recognitionRef.current.stop();
      }
      return;
    }

    const newRecognition = recognitionRef.current ?? new SpeechRecognition();
    newRecognition.continuous = false;
    newRecognition.lang = langRef.current;
    newRecognition.interimResults = true; // Get results as the user speaks
    if ('maxAlternatives' in newRecognition) {
      newRecognition.maxAlternatives = 1;
    }

    newRecognition.onstart = () => {
      if (!mountedRef.current || recognitionRef.current !== newRecognition || !activeRef.current) return;
      listeningRef.current = true;
      setRequestingPermission(false);
      setListening(true);
      setError(null);
      setTranscript('');
      setInterimTranscript('');
    };

    newRecognition.onend = () => {
      if (recognitionRef.current !== newRecognition) return;
      activeRef.current = false;
      listeningRef.current = false;
      if (mountedRef.current) {
        setRequestingPermission(false);
        setListening(false);
      }
    };

    newRecognition.onerror = (event) => {
      if (recognitionRef.current !== newRecognition || !mountedRef.current) return;
      activeRef.current = false;
      listeningRef.current = false;
      setRequestingPermission(false);
      setListening(false);
      setInterimTranscript('');
      setError(event.error || 'unknown-error');
    };

    newRecognition.onresult = (event) => {
      if (!mountedRef.current || recognitionRef.current !== newRecognition || !activeRef.current) return;
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
      activeRef.current = true;
      setRequestingPermission(true);
      newRecognition.start();
    } catch (err) {
      activeRef.current = false;
      listeningRef.current = false;
      setRequestingPermission(false);
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
    mountedRef.current = true;
    return () => {
      const recognition = recognitionRef.current;
      mountedRef.current = false;
      activeRef.current = false;
      listeningRef.current = false;
      setRequestingPermission(false);
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
    };
  }, [detachHandlers]);

  return {
    listening,
    requestingPermission,
    transcript,
    interimTranscript,
    isSupported,
    error,
    start,
    stop,
    resetTranscript,
    clearError,
  };
}
