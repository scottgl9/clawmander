import { useState, useRef, useCallback } from 'react';
import { voiceApi } from '../lib/chatApi';
import { useServiceSettings } from './useServiceSettings';

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')       // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links
    .replace(/<[^>]+>/g, '')               // HTML tags
    .replace(/#{1,6}\s+/g, '')             // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // bold
    .replace(/\*([^*]+)\*/g, '$1')         // italic
    .replace(/~~([^~]+)~~/g, '$1')         // strikethrough
    .replace(/>\s+/g, '')                  // blockquotes
    .replace(/[-*+]\s+/g, '')              // list markers
    .replace(/\d+\.\s+/g, '')             // ordered lists
    .replace(/\n{2,}/g, '. ')              // paragraph breaks
    .replace(/\n/g, ' ')                   // line breaks
    .trim();
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const abortRef = useRef(null);
  const { settings: serviceSettings } = useServiceSettings();

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text, voice = 'default') => {
    // Stop any current playback
    stop();

    const cleaned = stripMarkdown(text);
    if (!cleaned) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const blob = await voiceApi.speak(cleaned, voice, controller.signal, serviceSettings.chatterboxUrl);
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        urlRef.current = null;
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        setError('Audio playback failed');
        URL.revokeObjectURL(url);
        urlRef.current = null;
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setIsLoading(false);
    }
  }, [stop]);

  return { speak, stop, isSpeaking, isLoading, error };
}
