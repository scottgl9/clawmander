import { useCallback } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { useChatState } from '../../hooks/useChatState';
import { chatApi } from '../../lib/chatApi';
import SessionSidebar from './SessionSidebar';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ApprovalBanner from './ApprovalBanner';
import SubagentBadge from './SubagentBadge';
import AgentPresenceBar from './AgentPresenceBar';

export default function ChatPage({ onConnectionChange }) {
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

  // Connect SSE (chat events are already in the useSSE event list)
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

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSession={activeSession}
        connected={connected}
        onSelect={switchSession}
        onReload={loadSessions}
        onNewSession={createSession}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Presence bar */}
        <AgentPresenceBar sessions={sessions} activeSession={activeSession} />

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
