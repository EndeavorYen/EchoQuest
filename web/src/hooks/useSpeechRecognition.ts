import { useState, useRef } from 'react';

// Speech Recognition Hook
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // Failsafe in case onend doesn't fire
      listeningTimeoutRef.current = setTimeout(() => {
        console.warn("Speech recognition 'onend' timed out. Forcing state update.");
        setListening(false);
      }, 5000);
    }
  };

  const start = () => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
    }
    if (listening) {
      stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported.");
      return;
    }

    const newRecognition = new SpeechRecognition();
    newRecognition.continuous = false;
    newRecognition.lang = 'en-US';
    newRecognition.interimResults = false;

    newRecognition.onstart = () => {
      setListening(true);
    };
    newRecognition.onend = () => {
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      setListening(false);
      recognitionRef.current = null;
    };
    newRecognition.onerror = (event: any) => {
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      console.error(`Speech recognition error: ${event.error}`);
      setListening(false);
      recognitionRef.current = null;
    };
    newRecognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
    };

    newRecognition.start();
    recognitionRef.current = newRecognition;
  };

  const resetTranscript = () => {
    setTranscript('');
  };

  return { listening, transcript, start, stop, resetTranscript };
}
