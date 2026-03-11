import { useState, useRef, useCallback, useEffect } from 'react';

const ERROR_MESSAGES = {
  'no-speech': 'No speech detected. Try again.',
  'audio-capture': 'Microphone not available.',
  'not-allowed': 'Microphone permission denied.',
  'network': 'Network error during recognition.',
  'aborted': 'Recognition was aborted.',
  'language-not-supported': 'Language not supported.',
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(options = {}) {
  const { continuous = false } = options;
  const [state, setState] = useState('idle'); // 'idle' | 'listening' | 'error'
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const isSupported = !!getSpeechRecognition();

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setState('idle');
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => {
      setState('listening');
      setError(null);
      setTranscript('');
      finalTranscript = '';
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      const msg = ERROR_MESSAGES[event.error] || `Recognition error: ${event.error}`;
      setError(msg);
      setState('error');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      // Only set idle if we're still in listening state (not error)
      setState((prev) => (prev === 'listening' ? 'idle' : prev));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [continuous]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return { state, transcript, start, stop, isSupported, error };
}
