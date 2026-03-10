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

  // No filtered sessions available
  if (connected && sessions.length > 0 && filteredSessions.length === 0) {
    return (
      <div className="flex h-full">
        <SessionSidebar
          sessions={sessions}
          filteredSessions={filteredSessions}
          filter={filter}
          onFilterChange={setFilter}
          activeSession={activeSession}
          connected={connected}
          onSelect={switchSession}
          onReload={loadSessions}
          onNewSession={createSession}
        />
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          No sessions match the current filter
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <SessionSidebar
        sessions={sessions}
        filteredSessions={filteredSessions}
        filter={filter}
        onFilterChange={setFilter}
        activeSession={activeSession}
        connected={connected}
        onSelect={switchSession}
        onReload={loadSessions}
        onNewSession={createSession}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Presence bar — only filtered sessions */}
        <AgentPresenceBar sessions={filteredSessions} activeSession={activeSession} />

        {/* No session selected */}
        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            {connected ? 'Select a session to start chatting' : 'Waiting for gateway connection...'}
          </div>
        ) : (
          <>
            {/* Messages */}
            <MessageList messages={currentMessages} loading={loadingHistory} />

            {/* Subagent activity */}
            <SubagentBadge activity={subagentActivity} />

            {/* Approval banner */}
            <ApprovalBanner
              approval={approvalPending}
              onResolved={() => setApprovalPending(null)}
            />

            {/* Error banner */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-300">×</button>
              </div>
            )}

            {/* Input */}
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
