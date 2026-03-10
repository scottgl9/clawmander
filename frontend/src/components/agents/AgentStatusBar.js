import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '../../hooks/useSSE';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function isAgentActive(agent) {
  if (agent.isWorking) return true;
  if (typeof agent.lastInputSeconds === 'number' && agent.lastInputSeconds < 60) return true;
  if (agent.status === 'working' || agent.status === 'active') return true;
  return false;
}

function getAgentLabel(agent) {
  return agent.name || agent.agentId || agent.id || 'Unknown';
}

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
    if (event.type === 'agent.presence') {
      const data = event.data;
      const agentId = data.agentId || data.id;
      if (!agentId) return;
      setAgents((prev) => {
        const idx = prev.findIndex((a) => (a.agentId || a.id) === agentId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [...prev, data];
      });
    }
  }, []);

  useSSE(handleSSEEvent);

  if (agents.length === 0) return null;

  const active = agents.filter(isAgentActive);
  const idle = agents.filter((a) => !isAgentActive(a));

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-gray-900 overflow-x-auto">
      {active.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider flex-shrink-0">Active</span>
          <div className="flex items-center gap-2 flex-wrap">
            {active.map((a) => (
              <div
                key={a.agentId || a.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-xs text-green-400 flex-shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>{getAgentLabel(a)}</span>
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
          <div className="flex items-center gap-2 flex-wrap">
            {idle.map((a) => (
              <div
                key={a.agentId || a.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs text-gray-500 flex-shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                <span>{getAgentLabel(a)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
