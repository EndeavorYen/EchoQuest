import { useState, useRef, useCallback } from 'react';

// Speech Recognition Hook
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
}

export interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
}

export function useSpeechRecognition({ onResult }: UseSpeechRecognitionOptions = {}) {
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const manualStop = useRef(false);
  const langRef = useRef('en-US');

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      manualStop.current = true;
      recognitionRef.current.stop();
    }
  }, []);

  const start = useCallback((lang: string = 'en-US') => {
    langRef.current = lang;
    manualStop.current = false;

    if (listening) {
      // If we are already listening, a call to start is likely to set a new language.
      // We can stop the current recognition, and onend will handle the restart with the new language.
      if (recognitionRef.current && recognitionRef.current.lang !== lang) {
         recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported.");
      return;
    }

    const newRecognition = new SpeechRecognition();
    newRecognition.continuous = true;
    newRecognition.lang = langRef.current;
    newRecognition.interimResults = true;

    newRecognition.onstart = () => {
      setListening(true);
      setInterimTranscript('');
    };

    newRecognition.onend = () => {
      setListening(false);
      setInterimTranscript('');
      if (!manualStop.current) {
        // If the recognition ended unexpectedly, restart it
        start(langRef.current);
      }
      recognitionRef.current = null;
    };

    newRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error(`Speech recognition error: ${event.error}`);
      // Some errors are not fatal, we can try to restart.
      // 'no-speech' and 'network' are common issues that might resolve.
      if (event.error === 'no-speech' || event.error === 'network') {
        if (!manualStop.current) {
            // Treat it like an unexpected end.
            newRecognition.stop(); // Stop the current errored instance
        }
      } else {
        setListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      }
    };

    newRecognition.onresult = (event: any) => {
      let final_transcript = '';
      let interim_transcript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }

      if (final_transcript && onResult) {
        onResult(final_transcript.trim());
      }
      setInterimTranscript(interim_transcript);
    };

    newRecognition.start();
    recognitionRef.current = newRecognition;
  }, [listening, onResult]);

  const resetTranscript = () => {
    // Transcript is now managed by the parent component.
    // Interim transcript is still internal.
    setInterimTranscript('');
  };

  // We no longer return `transcript` as it's handled via onResult.
  return { listening, interimTranscript, start, stop, resetTranscript };
}
