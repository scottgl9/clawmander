import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { useChatState } from '../../hooks/useChatState';
import { chatApi } from '../../lib/chatApi';
import SessionSidebar from './SessionSidebar';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ApprovalBanner from './ApprovalBanner';
import SubagentBadge from './SubagentBadge';
import AgentPresenceBar from './AgentPresenceBar';

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
  // direct: only agent:<agentId>:clawmander:<number> sessions (created via clawmander UI)
  return sessions.filter((s) => {
    const key = getSessionKey(s);
    if (!key.startsWith('agent:')) return false;
    const match = key.match(/^agent:[^:]+:clawmander:(\d+)$/);
    return match !== null;
  });
}

export default function ChatPage({ onConnectionChange }) {
  const [filter, setFilter] = useState('direct');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const {
    sessions,
    models,
    activeSession,
    messages,
    streamingContent,
    streamingRunId,
    approvalPending,
    setApprovalPending,
    subagentActivity,
    connected,
    sending,
    loadingHistory,
    error,
    setError,
    loadSessions,
    switchSession,
    switchModel,
    createSession,
    sendMessage,
    handleSSEEvent,
  } = useChatState();

  const filteredSessions = useMemo(() => filterSessions(sessions, filter), [sessions, filter]);

  // Auto-select first filtered session when sessions load or filter changes
  useEffect(() => {
    if (filteredSessions.length === 0) return;
    const activeInFiltered = filteredSessions.some((s) => getSessionKey(s) === activeSession);
    if (!activeInFiltered) {
      switchSession(getSessionKey(filteredSessions[0]));
    }
  }, [filteredSessions]);

  // Connect SSE
  const sseConnected = useSSE(handleSSEEvent);

  // Relay connection state to parent (Layout)
  if (onConnectionChange) onConnectionChange(sseConnected);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
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
    switch (action) {
      case 'switchModel':
        switchModel(payload);
        break;
      default:
        break;
    }
  }, [switchModel]);

  const handleAbort = useCallback(async () => {
    if (!activeSession) return;
    try {
      await chatApi.abort(activeSession);
    } catch (err) {
      setError(err.message);
    }
  }, [activeSession, setError]);

  const currentMessages = activeSession ? (messages[activeSession] || []) : [];

  const activeSessionObj = sessions.find((s) => getSessionKey(s) === activeSession);
  const activeSessionLabel = activeSessionObj ? getSessionLabel(activeSessionObj) : 'Chat';

  const sidebar = (
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
  );

  const FILTER_OPTIONS = [
    { key: 'direct', label: 'Direct' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session sidebar — full screen on mobile when open, fixed column on desktop */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-auto flex-shrink-0`}>
        {sidebar}
      </div>

      {/* Main chat area — full screen on mobile when sidebar is closed */}
      <div className={`${!mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden`}>

        {/* Mobile header: session dropdown */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 md:hidden bg-gray-900">
          {/* Session dropdown trigger */}
          <div ref={dropdownRef} className="flex-1 relative min-w-0">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 rounded-lg transition-colors"
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

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                {/* Filter tabs */}
                <div className="flex border-b border-gray-800">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFilter(opt.key)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        filter === opt.key
                          ? 'text-white bg-gray-700'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Session list */}
                <div className="max-h-60 overflow-y-auto">
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
            )}
          </div>

          {/* Connection indicator */}
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} title={connected ? 'Connected' : 'Offline'} />
        </div>

        {/* Presence bar */}
        <AgentPresenceBar sessions={filteredSessions} activeSession={activeSession} />

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
            <MessageList messages={currentMessages} loading={loadingHistory} />
            <SubagentBadge activity={subagentActivity} />
            <ApprovalBanner
              approval={approvalPending}
              onResolved={() => setApprovalPending(null)}
            />
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


    </div>
  );
}
