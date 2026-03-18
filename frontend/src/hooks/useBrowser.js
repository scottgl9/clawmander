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
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [lastClickInfo, setLastClickInfo] = useState(null);
  const [inputBlocked, setInputBlocked] = useState(null);
  const [agentChecklist, setAgentChecklist] = useState(null);

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
          if (msg.pages) setPages(msg.pages);
          if (msg.activePageId) setActivePageId(msg.activePageId);
          break;
        case 'meta':
          setUrl(msg.url || '');
          setTitle(msg.title || '');
          if (msg.controlMode) setControlMode(msg.controlMode);
          if (msg.pages) setPages(msg.pages);
          break;
        case 'pages-updated':
          setPages(msg.pages || []);
          setActivePageId(msg.activePageId || null);
          break;
        case 'control':
          setControlMode(msg.mode);
          break;
        case 'agent-message':
          setAgentMessage(msg.message);
          setAgentChecklist(msg.checklist || null);
          break;
        case 'click-ack':
          setLastClickInfo(msg);
          break;
        case 'input-blocked':
          setInputBlocked(msg);
          setTimeout(() => setInputBlocked(null), 3000);
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
  const goBack = useCallback(() => sendJSON({ type: 'back' }), [sendJSON]);
  const goForward = useCallback(() => sendJSON({ type: 'forward' }), [sendJSON]);
  const reload = useCallback(() => sendJSON({ type: 'reload' }), [sendJSON]);
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
  const sendKeyboardAction = useCallback((action, opts = {}) => sendJSON({ type: 'keyboard-action', action, ...opts }), [sendJSON]);
  const sendClickSelector = useCallback((opts) => sendJSON({ type: 'click-selector', ...opts }), [sendJSON]);
  const switchPage = useCallback((pageId) => sendJSON({ type: 'switch-page', pageId }), [sendJSON]);
  const closePage = useCallback((pageId) => sendJSON({ type: 'close-page', pageId }), [sendJSON]);

  return {
    status,
    url,
    title,
    controlMode,
    agentMessage,
    agentChecklist,
    viewportSize,
    pages,
    activePageId,
    lastClickInfo,
    inputBlocked,
    navigate,
    goBack,
    goForward,
    reload,
    sendClick,
    sendType,
    sendKey,
    sendScroll,
    sendMouseMove,
    sendKeyboardAction,
    sendClickSelector,
    takeControl,
    releaseControl,
    switchPage,
    closePage,
  };
}
