import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { useChatState } from '../../hooks/useChatState';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';
import { chatApi } from '../../lib/chatApi';
import SessionSidebar from './SessionSidebar';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ApprovalBanner from './ApprovalBanner';
import SubagentBadge from './SubagentBadge';
import AgentPresenceBar from './AgentPresenceBar';

const FILTER_OPTIONS = [
  { key: 'direct', label: 'Direct' },
  { key: 'all', label: 'All' },
];

function getSessionKey(s) {
  return s.key || s.sessionKey || '';
}

function getSessionLabel(s) {
  return s.displayName || s.agentId || s.key || s.sessionKey || 'Unknown';
}

function filterSessions(sessions, filter) {
  if (filter === 'all') {
    return sessions.filter((s) => !getSessionKey(s).includes(':cron:'));
  }
  return sessions.filter((s) => {
    const key = getSessionKey(s);
    if (!key.startsWith('agent:')) return false;
    return /^agent:[^:]+:clawmander:(\d+)$/.test(key);
  });
}

export default function ChatPage({ onConnectionChange }) {
  const [filter, setFilter] = useState('direct');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const lastSpokenIdRef = useRef(null);

  const { speak, stop: stopSpeaking, isSpeaking } = useTextToSpeech();
  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();

  const {
    sessions, models, activeSession, messages,
    approvalPending, setApprovalPending, subagentActivity,
    connected, sending, loadingHistory, error, setError,
    loadSessions, switchSession, switchModel, createSession,
    sendMessage, handleSSEEvent,
  } = useChatState();

  const filteredSessions = useMemo(() => filterSessions(sessions, filter), [sessions, filter]);

  // Auto-select first filtered session when sessions load or filter changes
  useEffect(() => {
    if (filteredSessions.length === 0) return;
    const activeInFiltered = filteredSessions.some((s) => getSessionKey(s) === activeSession);
    if (!activeInFiltered) switchSession(getSessionKey(filteredSessions[0]));
  }, [filteredSessions]);

  const sseConnected = useSSE(handleSSEEvent);
  if (onConnectionChange) onConnectionChange(sseConnected);

  // Close dropdown on outside click/touch
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [dropdownOpen]);

  const handleSelectSession = useCallback((key) => {
    switchSession(key);
    setMobileSidebarOpen(false);
    setDropdownOpen(false);
  }, [switchSession]);

  const handleAction = useCallback((action, payload) => {
    if (action === 'switchModel') switchModel(payload);
  }, [switchModel]);

  const handleAbort = useCallback(async () => {
    if (!activeSession) return;
    try { await chatApi.abort(activeSession); }
    catch (err) { setError(err.message); }
  }, [activeSession, setError]);

  const openDropdown = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropdownRect(rect);
    setDropdownOpen((o) => !o);
  }, []);

  // Recalculate dropdown position on window resize / orientation change
  useEffect(() => {
    if (!dropdownOpen) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect(rect);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [dropdownOpen]);

  // Auto-speak when TTS is enabled and a message completes
  useEffect(() => {
    if (!voiceSettings.ttsEnabled || !activeSession) return;
    const msgs = messages[activeSession] || [];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant' && m.state === 'complete');
    if (lastAssistant && lastAssistant.id !== lastSpokenIdRef.current && lastAssistant.content) {
      lastSpokenIdRef.current = lastAssistant.id;
      speak(lastAssistant.content, voiceSettings.voiceName);
    }
  }, [messages, activeSession, voiceSettings.ttsEnabled]);

  const handleSpeak = useCallback((content) => {
    speak(content, voiceSettings.voiceName);
  }, [speak, voiceSettings.voiceName]);

  const toggleTts = useCallback(() => {
    const next = !voiceSettings.ttsEnabled;
    updateVoiceSettings({ ttsEnabled: next });
    if (!next) stopSpeaking();
  }, [voiceSettings.ttsEnabled, updateVoiceSettings, stopSpeaking]);

  const currentMessages = activeSession ? (messages[activeSession] || []) : [];
  const activeSessionObj = sessions.find((s) => getSessionKey(s) === activeSession);
  const activeSessionLabel = activeSessionObj ? getSessionLabel(activeSessionObj) : 'Chat';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session sidebar — full screen on mobile when open, fixed column on desktop */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-auto flex-shrink-0`}>
        <SessionSidebar
          sessions={sessions}
          filteredSessions={filteredSessions}
          filter={filter}
          onFilterChange={setFilter}
          activeSession={activeSession}
          connected={connected}
          onSelect={handleSelectSession}
          onReload={loadSessions}
          onNewSession={createSession}
          models={models}
        />
      </div>

      {/* Main chat area */}
      <div className={`${!mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden`}>

        {/* Mobile header: session dropdown trigger */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 md:hidden bg-gray-900 flex-shrink-0">
          <button
            ref={triggerRef}
            onClick={openDropdown}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 rounded-lg transition-colors min-w-0"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-200 truncate text-left">{activeSessionLabel}</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              className={`flex-shrink-0 text-gray-500 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={toggleTts}
            className={`flex-shrink-0 p-1 rounded transition-colors ${voiceSettings.ttsEnabled ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}
            title={voiceSettings.ttsEnabled ? 'TTS on — click to mute' : 'TTS off — click to enable'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </button>
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`}
            title={connected ? 'Connected' : 'Offline'}
          />
        </div>

        {/* Presence bar (desktop only) */}
        <div className="hidden md:flex items-center">
          <div className="flex-1"><AgentPresenceBar sessions={filteredSessions} activeSession={activeSession} /></div>
          <button
            onClick={toggleTts}
            className={`flex-shrink-0 mr-3 p-1.5 rounded transition-colors ${voiceSettings.ttsEnabled ? 'text-blue-400 bg-blue-900/30' : 'text-gray-600 hover:text-gray-400'}`}
            title={voiceSettings.ttsEnabled ? 'TTS on — click to mute' : 'TTS off — click to enable'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </button>
        </div>

        {connected && sessions.length > 0 && filteredSessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            No sessions match the current filter
          </div>
        ) : !activeSession ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            {connected ? 'Select a session to start chatting' : 'Waiting for gateway connection...'}
          </div>
        ) : (
          <>
            <MessageList messages={currentMessages} loading={loadingHistory} onSpeak={handleSpeak} />
            <SubagentBadge activity={subagentActivity} />
            <ApprovalBanner approval={approvalPending} onResolved={() => setApprovalPending(null)} />
            {error && (
              <div className="mx-4 mb-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-300">×</button>
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              onAbort={handleAbort}
              onAction={handleAction}
              sending={sending}
              disabled={!connected}
              models={models}
            />
          </>
        )}
      </div>

      {/* Session dropdown — fixed position so it escapes all overflow:hidden ancestors */}
      {dropdownOpen && dropdownRect && (() => {
        const MARGIN = 8;
        const top = dropdownRect.bottom + 4;
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
        // Max height: space from dropdown top to bottom of viewport minus margin
        const maxH = Math.max(120, viewportH - top - MARGIN);
        return (
        <div
          ref={dropdownRef}
          className="md:hidden fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl flex flex-col"
          style={{
            top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: maxH,
          }}
        >
          {/* Filter tabs */}
          <div className="flex border-b border-gray-800 flex-shrink-0">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  filter === opt.key ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Session list — scrollable within the available space */}
          <div className="overflow-y-auto flex-1">
            {filteredSessions.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-gray-600">No sessions</div>
            ) : (
              filteredSessions.map((s) => {
                const key = getSessionKey(s);
                const label = getSessionLabel(s);
                const isActive = key === activeSession;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectSession(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-900/40 text-white'
                        : 'text-gray-400 hover:bg-gray-800 active:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm flex-1 truncate">{label}</span>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-blue-400 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
