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
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const stop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // No need for a timeout failsafe here, onend should be reliable enough
      // for the purpose of stopping. The App's state handles the rest.
    }
  };

  const start = (lang: string = 'en-US') => {
    if (listening) {
      // If already listening, calling start again does nothing.
      // Use stop() to explicitly stop.
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported.");
      return;
    }

    const newRecognition = new SpeechRecognition();
    newRecognition.continuous = true; // Process multiple results
    newRecognition.lang = lang;
    newRecognition.interimResults = true; // Get results as the user speaks

    newRecognition.onstart = () => {
      setListening(true);
      setTranscript('');
      setInterimTranscript('');
    };

    newRecognition.onend = () => {
      setListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    newRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error(`Speech recognition error: ${event.error}`);
      setListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    newRecognition.onresult = (event: SpeechRecognitionEvent) => {
      let final_transcript = '';
      let interim_transcript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }

      setTranscript(prev => prev + final_transcript);
      setInterimTranscript(interim_transcript);
    };

    newRecognition.start();
    recognitionRef.current = newRecognition;
  };

  const resetTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return { listening, transcript, interimTranscript, start, stop, resetTranscript };
}
