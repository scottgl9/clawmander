import { useEffect, useRef, useState, useCallback } from 'react';
import { API_URL } from '../lib/constants';

export function useSSE(onEvent) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const wasConnectedRef = useRef(false);
  const retryDelayRef = useRef(3000);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource(`${API_URL}/api/sse/subscribe`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryDelayRef.current = 3000; // reset backoff on successful open
      if (wasConnectedRef.current) {
        // SSE reconnected after a drop — notify listeners so they can reload stale data
        onEventRef.current({ type: 'sse.reconnected', data: {} });
      }
      wasConnectedRef.current = true;
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30000);
      setTimeout(connect, delay);
    };

    const events = [
      'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
      'agent.status_changed', 'heartbeat.received', 'system.health',
      'server.status',
      'chat.delta', 'chat.final', 'chat.error', 'chat.aborted',
      'chat.approval', 'chat.approval.resolved', 'chat.subagent',
      'agent.status', 'agent.status.snapshot',
      'feed.new', 'cron.status',
      'actionitem.created', 'actionitem.updated', 'actionitem.deleted',
      'budget.transaction_created', 'budget.transaction_updated', 'budget.transaction_deleted',
      'budget.category_created', 'budget.category_updated', 'budget.category_deleted',
      'drawing.created', 'drawing.updated', 'drawing.deleted',
      'browser.created', 'browser.destroyed', 'browser.control_changed',
      'browser.control_requested', 'browser.url_changed',
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
