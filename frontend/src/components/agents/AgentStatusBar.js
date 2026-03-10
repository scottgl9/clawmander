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

  const handleSSEEvent = useCallback((event) => {
    if (event.type === 'agent.status.snapshot') {
      if (Array.isArray(event.data.agents)) setAgents(event.data.agents);
      return;
    }
    if (event.type !== 'agent.status') return;
    const { agentId, isWorking, name, runId, sessionKey } = event.data;
    if (!agentId) return;
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === agentId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isWorking, runId, sessionKey };
        return updated;
      }
      return [...prev, { id: agentId, name: name || agentId, isWorking, runId, sessionKey }];
    });
  }, []);

  useSSE(handleSSEEvent);

  if (agents.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-gray-800 bg-gray-900">
      <div className="flex flex-wrap gap-2">
        {agents.map((a) => (
          <div
            key={a.id}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              a.isWorking
                ? 'bg-green-900/40 border border-green-700/50 text-green-400'
                : 'bg-gray-800 border border-gray-700 text-gray-500'
            }`}
            title={a.sessionKey || a.id}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              a.isWorking ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            }`} />
            <span>{a.name || a.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
