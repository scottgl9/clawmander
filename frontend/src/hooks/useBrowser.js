import { useEffect, useRef, useState, useCallback } from 'react';

const STATUS = { connecting: 'connecting', connected: 'connected', disconnected: 'disconnected' };

export default function useBrowser(instanceId, canvasRef) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState(STATUS.connecting);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [controlMode, setControlMode] = useState('shared');
  const [agentMessage, setAgentMessage] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 });

  const connect = useCallback(() => {
    if (!mountedRef.current || !instanceId) return;

    setStatus(STATUS.connecting);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/browser/${instanceId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus(STATUS.connected);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      // Binary message = JPEG frame
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        createImageBitmap(blob).then((bitmap) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
        }).catch(() => {});
        return;
      }

      // JSON message
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'connected':
          setUrl(msg.url || '');
          setTitle(msg.title || '');
          setControlMode(msg.controlMode || 'shared');
          if (msg.viewport) setViewportSize(msg.viewport);
          break;
        case 'meta':
          setUrl(msg.url || '');
          setTitle(msg.title || '');
          if (msg.controlMode) setControlMode(msg.controlMode);
          break;
        case 'control':
          setControlMode(msg.mode);
          break;
        case 'agent-message':
          setAgentMessage(msg.message);
          break;
        case 'error':
          console.error('[Browser WS]', msg.message);
          break;
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus(STATUS.disconnected);
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 10000);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {};
  }, [instanceId, canvasRef]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendJSON = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const navigate = useCallback((navUrl) => sendJSON({ type: 'navigate', url: navUrl }), [sendJSON]);
  const sendClick = useCallback((normX, normY) => sendJSON({ type: 'click', x: normX, y: normY }), [sendJSON]);
  const sendType = useCallback((text) => sendJSON({ type: 'type', text }), [sendJSON]);
  const sendKey = useCallback((key) => sendJSON({ type: 'key', key }), [sendJSON]);
  const sendScroll = useCallback((normX, normY, delta) => sendJSON({ type: 'scroll', x: normX, y: normY, delta }), [sendJSON]);
  const sendMouseMove = useCallback((normX, normY) => sendJSON({ type: 'mousemove', x: normX, y: normY }), [sendJSON]);
  const takeControl = useCallback(() => sendJSON({ type: 'take-control' }), [sendJSON]);
  const releaseControl = useCallback(() => {
    setAgentMessage(null);
    sendJSON({ type: 'release-control' });
  }, [sendJSON]);

  return {
    status,
    url,
    title,
    controlMode,
    agentMessage,
    viewportSize,
    navigate,
    sendClick,
    sendType,
    sendKey,
    sendScroll,
    sendMouseMove,
    takeControl,
    releaseControl,
  };
}
