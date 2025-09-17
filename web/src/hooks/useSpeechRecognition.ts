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
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
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

const UNSUPPORTED_ERROR_MESSAGE = 'Speech recognition is not supported in this browser.';

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);

  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  });

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !listeningRef.current) {
      return;
    }

    listeningRef.current = false;
    try {
      recognition.stop();
    } catch (err) {
      if (typeof recognition.abort === 'function') {
        recognition.abort();
      }
    }
  }, []);

  const start = useCallback(
    (lang: string = 'en-US') => {
      if (!isSupported) {
        setError(UNSUPPORTED_ERROR_MESSAGE);
        return;
      }

      if (listeningRef.current) {
        return;
      }

      const SpeechRecognitionClass =
        (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

      if (!SpeechRecognitionClass) {
        setError(UNSUPPORTED_ERROR_MESSAGE);
        return;
      }

      let recognition = recognitionRef.current;

      if (!recognition) {
        recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        if ('maxAlternatives' in recognition) {
          recognition.maxAlternatives = 1;
        }

        recognition.onstart = () => {
          listeningRef.current = true;
          setError(null);
          setListening(true);
          setTranscript('');
          setInterimTranscript('');
        };

        recognition.onend = () => {
          listeningRef.current = false;
          setListening(false);
          setInterimTranscript('');
        };

        recognition.onerror = (event: any) => {
          listeningRef.current = false;
          setListening(false);
          setInterimTranscript('');
          setError(typeof event?.error === 'string' ? event.error : 'unknown-error');
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result || !result[0]) {
              continue;
            }
            const value = result[0].transcript ?? '';
            if (result.isFinal) {
              finalTranscript += value;
            } else {
              interim += value;
            }
          }

          if (finalTranscript) {
            setTranscript((prev) => {
              if (!prev) {
                return finalTranscript.trim();
              }
              return `${prev} ${finalTranscript}`.trim();
            });
          }

          setInterimTranscript(interim);
        };

        recognitionRef.current = recognition;
      }

      recognition.lang = lang;

      try {
        recognition.start();
      } catch (err) {
        const domError = err as DOMException;
        if (domError && domError.name === 'InvalidStateError') {
          // Safari throws if start is invoked twice without waiting for onend.
          return;
        }
        setError(domError?.message || 'Failed to start speech recognition.');
      }
    },
    [isSupported]
  );

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        return;
      }

      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;

      try {
        recognition.stop();
      } catch (err) {
        if (typeof recognition.abort === 'function') {
          recognition.abort();
        }
      }

      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      setInterimTranscript('');
    };
  }, []);

  return { listening, transcript, interimTranscript, isSupported, error, start, stop, resetTranscript };
}
