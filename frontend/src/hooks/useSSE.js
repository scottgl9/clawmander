import { useEffect, useRef, useState, useCallback } from 'react';
import { API_URL } from '../lib/constants';

export function useSSE(onEvent) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource(`${API_URL}/api/sse/subscribe`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000);
    };

    const events = [
      'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
      'agent.status_changed', 'heartbeat.received', 'system.health',
      'server.status',
      'chat.delta', 'chat.final', 'chat.error', 'chat.aborted',
      'chat.approval', 'chat.subagent',
      'agent.status', 'agent.status.snapshot',
      'feed.new', 'cron.status',
    ];
    events.forEach((evt) => {
      es.addEventListener(evt, (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current({ type: evt, data });
        } catch {}
      });
    });
  }, []);

  useEffect(() => {
    connect();
    return () => { if (esRef.current) esRef.current.close(); };
  }, [connect]);

  return connected;
}
