import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '../../hooks/useSSE';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AgentStatusBar() {
  const [agents, setAgents] = useState([]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/agents`);
      if (!res.ok) return;
      const { agents: list } = await res.json();
      if (Array.isArray(list)) setAgents(list);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Live updates via SSE
  const handleSSEEvent = useCallback((event) => {
    if (event.type === 'agent.status.snapshot') {
      // Full refresh on reconnect/startup
      if (Array.isArray(event.data.agents)) setAgents(event.data.agents);
      return;
    }
    if (event.type !== 'agent.status') return;
    const { agentId, isWorking, runId, sessionKey } = event.data;
    if (!agentId) return;
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === agentId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isWorking, runId, sessionKey };
        return updated;
      }
      return [...prev, { id: agentId, name: agentId, isWorking, runId, sessionKey }];
    });
  }, []);

  useSSE(handleSSEEvent);

  if (agents.length === 0) return null;

  const active = agents.filter((a) => a.isWorking);
  const idle = agents.filter((a) => !a.isWorking);

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-gray-900 overflow-x-auto">
      {active.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider flex-shrink-0">Active</span>
          <div className="flex items-center gap-2">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-xs text-green-400 flex-shrink-0"
                title={a.sessionKey || a.id}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>{a.name || a.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && idle.length > 0 && (
        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />
      )}

      {idle.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider flex-shrink-0">Idle</span>
          <div className="flex items-center gap-2">
            {idle.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs text-gray-500 flex-shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                <span>{a.name || a.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
