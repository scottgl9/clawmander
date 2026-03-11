function formatSessionKey(key) {
  if (!key) return null;
  const m = key.match(/^agent:(.+?):clawmander:(.+)$/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export default function AgentPresenceBar({ sessions, activeSession }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-3 px-4 py-2 border-b border-gray-800 overflow-x-auto">
      <span className="text-xs text-gray-600 flex-shrink-0">Sessions:</span>
      {sessions.slice(0, 8).map((s) => {
        const key = s.key || s.sessionKey;
        const label = s.displayName || formatSessionKey(key) || s.agentId || key;
        const isActive = key === activeSession;
        return (
          <div
            key={key}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${
              isActive ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'text-gray-500'
            }`}
          >
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="max-w-[120px] truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
