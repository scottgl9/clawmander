import { useState, useMemo, useCallback, useEffect } from 'react';
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

  const handleSelectSession = useCallback((key) => {
    switchSession(key);
    setMobileSidebarOpen(false);
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
  const activeSessionLabel = activeSessionObj?.displayName || activeSessionObj?.agentId || activeSession?.split(':')[1] || 'Chat';

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

  return (
    <div className="flex h-full">
      {/* Session sidebar — full screen on mobile when open, fixed column on desktop */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-auto flex-shrink-0`}>
        {sidebar}
      </div>

      {/* Main chat area — full screen on mobile when sidebar is closed */}
      <div className={`${!mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>

        {/* Mobile header: back button + session name */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 md:hidden bg-gray-900">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Sessions
          </button>
          <span className="text-sm font-medium text-gray-300 truncate">{activeSessionLabel}</span>
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
