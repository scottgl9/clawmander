import { useState, useEffect, useRef, useCallback } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { useChatState } from '../../hooks/useChatState';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';
import VoiceSettingsPanel from './VoiceSettingsPanel';

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
};

function getSessionKey(s) {
  return s.key || s.sessionKey || '';
}
function formatSessionKey(key) {
  if (!key) return null;
  const m = key.match(/^agent:(.+?):clawmander:(.+)$/);
  return m ? `${m[1]}:${m[2]}` : null;
}
function getSessionLabel(s) {
  const key = s.key || s.sessionKey;
  return s.displayName || formatSessionKey(key) || s.agentId || key || 'Unknown';
}

export default function VoicePage({ onConnectionChange }) {
  const [voiceState, setVoiceState] = useState(STATES.IDLE);
  const [lastResponse, setLastResponse] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const pendingTranscriptRef = useRef('');

  const { settings, updateSettings } = useVoiceSettings();
  const { state: micState, transcript, start: micStart, stop: micStop, isSupported } = useSpeechRecognition({ continuous: true });
  const { speak, stop: stopSpeaking, isSpeaking, isLoading: ttsLoading } = useTextToSpeech();

  const {
    sessions, activeSession, messages, connected, sending,
    loadSessions, switchSession, sendMessage, handleSSEEvent,
  } = useChatState();

  const sseConnected = useSSE(handleSSEEvent);
  if (onConnectionChange) onConnectionChange(sseConnected);

  // Track speaking state
  useEffect(() => {
    if (isSpeaking) setVoiceState(STATES.SPEAKING);
    else if (ttsLoading) setVoiceState(STATES.SPEAKING);
  }, [isSpeaking, ttsLoading]);

  // When sending, set processing state
  useEffect(() => {
    if (sending) setVoiceState(STATES.PROCESSING);
  }, [sending]);

  // When mic is listening, set listening state
  useEffect(() => {
    if (micState === 'listening') setVoiceState(STATES.LISTENING);
  }, [micState]);

  // Auto-speak completed assistant responses
  const lastSpokenIdRef = useRef(null);
  useEffect(() => {
    if (!activeSession || !settings.ttsEnabled) return;
    const msgs = messages[activeSession] || [];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant' && m.state === 'complete');
    if (lastAssistant && lastAssistant.id !== lastSpokenIdRef.current && lastAssistant.content) {
      lastSpokenIdRef.current = lastAssistant.id;
      setLastResponse(lastAssistant.content);
      speak(lastAssistant.content, settings.voiceName).then(() => {
        // Auto-listen after speaking completes
        if (settings.autoListen && isSupported) {
          setTimeout(() => micStart(), 300);
        }
      });
    } else if (lastAssistant && lastAssistant.id !== lastSpokenIdRef.current && !settings.ttsEnabled) {
      lastSpokenIdRef.current = lastAssistant.id;
      setLastResponse(lastAssistant.content || '');
      if (settings.autoListen && isSupported) {
        setTimeout(() => micStart(), 300);
      }
    }
  }, [messages, activeSession, settings.ttsEnabled, settings.autoListen]);

  // When mic stops and we have a transcript, send it
  useEffect(() => {
    if (micState === 'idle' && pendingTranscriptRef.current) {
      const text = pendingTranscriptRef.current;
      pendingTranscriptRef.current = '';
      if (text.trim()) {
        sendMessage(text.trim());
      }
    }
  }, [micState, sendMessage]);

  // Keep pending transcript updated
  useEffect(() => {
    if (transcript) pendingTranscriptRef.current = transcript;
  }, [transcript]);

  const handleMicToggle = useCallback(() => {
    if (micState === 'listening') {
      micStop();
    } else {
      stopSpeaking();
      micStart();
    }
  }, [micState, micStart, micStop, stopSpeaking]);

  const handleSessionChange = useCallback((e) => {
    switchSession(e.target.value);
  }, [switchSession]);

  const stateLabel = {
    [STATES.IDLE]: 'Ready',
    [STATES.LISTENING]: 'Listening...',
    [STATES.PROCESSING]: 'Processing...',
    [STATES.SPEAKING]: 'Speaking...',
  };

  const stateColor = {
    [STATES.IDLE]: 'text-gray-400',
    [STATES.LISTENING]: 'text-red-400',
    [STATES.PROCESSING]: 'text-yellow-400',
    [STATES.SPEAKING]: 'text-blue-400',
  };

  // Filter sessions to direct ones
  const directSessions = sessions.filter((s) => {
    const key = getSessionKey(s);
    return key.startsWith('agent:') && /^agent:[^:]+:clawmander:(\d+)$/.test(key);
  });

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${stateColor[voiceState]}`}>
            {stateLabel[voiceState]}
          </span>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
        </div>

        <div className="flex items-center gap-2">
          {/* Session selector */}
          {directSessions.length > 0 && (
            <select
              value={activeSession || ''}
              onChange={handleSessionChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-blue-600"
            >
              {directSessions.map((s) => (
                <option key={getSessionKey(s)} value={getSessionKey(s)}>
                  {getSessionLabel(s)}
                </option>
              ))}
            </select>
          )}

          {/* Settings gear */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'text-blue-400 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
            title="Voice settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6 overflow-y-auto">
        {/* Settings panel (slide-out) */}
        {showSettings && (
          <div className="w-full max-w-sm">
            <VoiceSettingsPanel
              settings={settings}
              onUpdate={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}

        {/* Response card */}
        {lastResponse && (
          <div className="w-full max-w-lg bg-gray-800 rounded-2xl p-5 text-sm text-gray-200 leading-relaxed max-h-[40vh] overflow-y-auto">
            {lastResponse}
          </div>
        )}

        {/* Transcript preview */}
        {transcript && micState === 'listening' && (
          <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-400 italic">
            {transcript}
          </div>
        )}

        {!isSupported && (
          <div className="text-sm text-red-400">
            Speech recognition is not supported in this browser.
          </div>
        )}

        {!connected && (
          <div className="text-sm text-gray-500">
            Waiting for gateway connection...
          </div>
        )}
      </div>

      {/* Bottom: large mic FAB */}
      <div className="flex-shrink-0 flex justify-center pb-8 pt-4">
        <button
          onClick={handleMicToggle}
          disabled={!isSupported || !connected}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed ${
            micState === 'listening'
              ? 'bg-red-600 hover:bg-red-500 animate-pulse shadow-red-900/50'
              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'
          }`}
          title={micState === 'listening' ? 'Stop & send' : 'Start listening'}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
