import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSE } from '../../hooks/useSSE';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function shortSessionKey(sessionKey) {
  if (!sessionKey) return null;
  // agent:<agentId>:clawmander:<N>  →  clawmander:<N>
  // agent:<agentId>:matrix:channel:<id>  →  matrix:channel
  // agent:<agentId>:discord:channel:<id>  →  discord:channel
  const parts = sessionKey.split(':');
  if (parts[0] === 'agent' && parts.length >= 3) {
    const rest = parts.slice(2);
    if (rest[0] === 'clawmander') return `clawmander:${rest[1] || ''}`;
    if (rest.length >= 2) return `${rest[0]}:${rest[1]}`;
    return rest[0];
  }
  return sessionKey.slice(0, 24);
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function AgentStatusBar() {
  const [agents, setAgents] = useState([]);
  const [, setTick] = useState(0);
  const startedAtRef = useRef({});

  // Tick every second to update elapsed times
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

    // Track when agent becomes active
    if (isWorking && !startedAtRef.current[agentId]) {
      startedAtRef.current[agentId] = Date.now();
    } else if (!isWorking) {
      delete startedAtRef.current[agentId];
    }

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

  const now = Date.now();

  return (
    <div className="px-4 py-3 border-b border-gray-800 bg-gray-900">
      <div className="flex flex-wrap gap-2">
        {agents.map((a) => {
          const elapsed = a.isWorking && startedAtRef.current[a.id]
            ? now - startedAtRef.current[a.id]
            : null;
          const session = shortSessionKey(a.sessionKey);
          return (
            <div
              key={a.id}
              className={`flex items-start gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                a.isWorking
                  ? 'bg-green-900/40 border border-green-700/50 text-green-400'
                  : 'bg-gray-800 border border-gray-700 text-gray-500'
              }`}
              title={a.sessionKey || a.id}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${
                a.isWorking ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
              }`} />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{a.name || a.id}</span>
                  {elapsed !== null && (
                    <span className="text-green-500 font-mono tabular-nums flex-shrink-0">
                      {formatElapsed(elapsed)}
                    </span>
                  )}
                </div>
                {session && (
                  <span className={`text-[10px] font-normal truncate mt-0.5 ${
                    a.isWorking ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {session}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
