import { useState, useMemo } from 'react';
import { chatApi } from '../../lib/chatApi';

function getSessionLabel(s) {
  return s.displayName || s.agentId || s.key || s.sessionKey || 'Unknown';
}

function getSessionKey(s) {
  return s.key || s.sessionKey;
}

// Extract unique agent IDs from session keys (agent:<agentId>:...)
function extractAgents(sessions) {
  const seen = new Set();
  for (const s of sessions) {
    const key = getSessionKey(s);
    if (!key) continue;
    const parts = key.split(':');
    if (parts[0] === 'agent' && parts[1]) seen.add(parts[1]);
  }
  return [...seen].sort();
}

const FILTER_OPTIONS = [
  { key: 'direct', label: 'Direct' },
  { key: 'all', label: 'All' },
];

export default function SessionSidebar({ sessions, activeSession, onSelect, onReload, onNewSession, connected }) {
  const [showNewSession, setShowNewSession] = useState(false);
  const [filter, setFilter] = useState('direct'); // 'direct' | 'all'

  const agents = useMemo(() => extractAgents(sessions), [sessions]);

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    // 'direct' — hide matrix: and discord: channel sessions
    return sessions.filter((s) => {
      const key = getSessionKey(s);
      const kind = s.kind || '';
      if (kind === 'group') return false;
      // Also filter by key pattern for sessions without kind
      if (key.includes(':matrix:') || key.includes(':discord:')) return false;
      return true;
    });
  }, [sessions, filter]);

  const handleReset = async (e, sessionKey) => {
    e.stopPropagation();
    try {
      await chatApi.resetSession(sessionKey, 'new');
    } catch (err) {
      console.error('Reset failed:', err.message);
    }
  };

  const handleNewSession = (agentId) => {
    setShowNewSession(false);
    if (onNewSession) onNewSession(agentId);
  };

  return (
    <div className="w-52 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sessions</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewSession(!showNewSession)}
            className="text-gray-600 hover:text-green-400 transition-colors"
            title="New session"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button
            onClick={onReload}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            title="Refresh sessions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* New session agent picker */}
      {showNewSession && (
        <div className="border-b border-gray-800 bg-gray-850">
          <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Select agent</div>
          <div className="max-h-40 overflow-y-auto">
            {agents.map((agentId) => (
              <button
                key={agentId}
                onClick={() => handleNewSession(agentId)}
                className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {agentId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connection status + filter */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-500' : 'text-gray-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
          {connected ? 'Connected' : 'Offline'}
        </div>
        <div className="flex text-[10px]">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === opt.key ? 'bg-gray-700 text-gray-200' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-600 text-center">
            {connected ? 'No sessions' : 'Not connected'}
          </div>
        ) : (
          filteredSessions.map((s) => {
            const key = getSessionKey(s);
            const label = getSessionLabel(s);
            const isActive = key === activeSession;
            return (
              <div
                key={key}
                onClick={() => onSelect(key)}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                  isActive ? 'bg-blue-900/40 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="text-sm truncate">{label}</span>
                </div>
                <button
                  onClick={(e) => handleReset(e, key)}
                  title="Reset session"
                  className="hidden group-hover:flex text-gray-600 hover:text-gray-400 flex-shrink-0 ml-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: model info for active session */}
      {activeSession && (() => {
        const s = sessions.find((x) => getSessionKey(x) === activeSession);
        if (!s?.model) return null;
        return (
          <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-600 truncate">
            {s.model}
          </div>
        );
      })()}
    </div>
  );
}
