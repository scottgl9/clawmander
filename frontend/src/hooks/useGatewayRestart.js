import { useState, useRef, useCallback } from 'react';
import { API_URL } from '../lib/constants';

export function useGatewayRestart() {
  const [state, setState] = useState('idle'); // idle | restarting | success | error
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    elapsedRef.current = 0;
  }, []);

  const restart = useCallback(async () => {
    cleanup();
    setState('restarting');
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/gateway/restart`, { method: 'POST' });
      if (!res.ok) throw new Error(`Restart request failed: ${res.status}`);
    } catch (err) {
      setState('error');
      setError(err.message);
      return;
    }

    elapsedRef.current = 0;
    timerRef.current = setInterval(async () => {
      elapsedRef.current += 2000;
      if (elapsedRef.current > 30000) {
        cleanup();
        setState('error');
        setError('Gateway did not come back within 30 seconds.');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/gateway/status`);
        if (res.ok) {
          const body = await res.json();
          if (body.connected) {
            cleanup();
            setState('success');
          }
        }
      } catch {
        // still restarting, keep polling
      }
    }, 2000);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setError(null);
  }, [cleanup]);

  return { state, error, restart, reset };
}
