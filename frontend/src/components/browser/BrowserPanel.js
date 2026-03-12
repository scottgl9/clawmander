import { useRef, useState, useCallback, useEffect } from 'react';
import useBrowser from '../../hooks/useBrowser';
import ControlBadge from './ControlBadge';
import AgentMessageBanner from './AgentMessageBanner';

const STATUS_CONFIG = {
  connecting: { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Connecting...' },
  connected: { color: 'text-green-400', dot: 'bg-green-400', label: 'Connected' },
  disconnected: { color: 'text-red-400', dot: 'bg-red-400', label: 'Disconnected' },
};

export default function BrowserPanel({ instanceId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const hiddenInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const {
    status,
    url,
    controlMode,
    agentMessage,
    viewportSize,
    navigate,
    goBack,
    goForward,
    reload,
    sendClick,
    sendKey,
    sendType,
    sendScroll,
    sendMouseMove,
    takeControl,
    releaseControl,
  } = useBrowser(instanceId, canvasRef);

  // Sync URL bar with actual URL
  useEffect(() => {
    setUrlInput(url);
  }, [url]);

  // Track container size for scaling canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Compute canvas display size to fill container while keeping aspect ratio
  const canvasStyle = (() => {
    if (!containerSize.width || !containerSize.height || !viewportSize.width) return {};
    const containerAspect = containerSize.width / containerSize.height;
    const vpAspect = viewportSize.width / viewportSize.height;
    if (containerAspect > vpAspect) {
      // Container is wider — fit to height
      const h = containerSize.height;
      const w = h * vpAspect;
      return { width: w, height: h };
    } else {
      // Container is taller — fit to width
      const w = containerSize.width;
      const h = w / vpAspect;
      return { width: w, height: h };
    }
  })();

  const handleUrlSubmit = useCallback((e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      navigate(urlInput.trim());
    }
  }, [urlInput, navigate]);

  const getNormalizedCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const { x, y } = getNormalizedCoords(e);
    sendClick(x, y);
    // Focus hidden input to enable mobile keyboard
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [getNormalizedCoords, sendClick]);

  // Touch support for mobile
  const handleTouchEnd = useCallback((e) => {
    if (e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    sendClick(x, y);
    // Focus hidden input for mobile keyboard
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [sendClick]);

  const handleCanvasWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getNormalizedCoords(e);
    sendScroll(x, y, e.deltaY);
  }, [getNormalizedCoords, sendScroll]);

  const handleCanvasMouseMove = useCallback((e) => {
    const { x, y } = getNormalizedCoords(e);
    sendMouseMove(x, y);
  }, [getNormalizedCoords, sendMouseMove]);

  const handleKeyDown = useCallback((e) => {
    // Don't capture keys when URL bar is focused
    if (e.target.tagName === 'INPUT' && e.target !== hiddenInputRef.current) return;
    e.preventDefault();

    const keyMap = {
      Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Escape',
      ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
      Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
      ' ': 'Space',
    };

    if (keyMap[e.key]) {
      sendKey(keyMap[e.key]);
    } else if (e.key.length === 1) {
      sendKey(e.key);
    }
  }, [sendKey]);

  // Hidden input for mobile keyboard — send each character as typed
  const handleHiddenInput = useCallback((e) => {
    const value = e.target.value;
    if (value) {
      sendType(value);
      e.target.value = '';
    }
  }, [sendType]);

  const handleControlToggle = useCallback(() => {
    if (controlMode === 'user') {
      releaseControl();
    } else {
      takeControl();
    }
  }, [controlMode, takeControl, releaseControl]);

  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <div className="flex flex-col h-full relative" style={{ background: '#0f1117' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-gray-800 bg-surface-light">
        {/* Navigation buttons */}
        <button
          onClick={goBack}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <button
          onClick={goForward}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Forward"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
        <button
          onClick={reload}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Reload"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* URL bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter URL..."
            className="w-full px-2 sm:px-3 py-1.5 text-sm bg-surface-lighter border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </form>

        {/* Keyboard toggle for mobile */}
        <button
          onClick={() => hiddenInputRef.current?.focus()}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors sm:hidden"
          title="Open Keyboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="4" width="20" height="14" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
          </svg>
        </button>

        {/* Control badge */}
        <ControlBadge mode={controlMode} onToggle={handleControlToggle} />

        {/* Connection status */}
        <span className={`text-xs ${statusConf.color} flex items-center gap-1 shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          <span className="hidden sm:inline">{statusConf.label}</span>
        </span>
      </div>

      {/* Agent message banner */}
      <AgentMessageBanner message={agentMessage} onRelease={releaseControl} />

      {/* Hidden input for mobile keyboard capture */}
      <input
        ref={hiddenInputRef}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        onInput={handleHiddenInput}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        style={{ position: 'absolute', top: -9999, left: -9999 }}
        tabIndex={-1}
      />

      {/* Canvas viewport — fills all remaining space */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ background: '#1a1b26' }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onClick={handleCanvasClick}
          onTouchEnd={handleTouchEnd}
          onWheel={handleCanvasWheel}
          onMouseMove={handleCanvasMouseMove}
          onKeyDown={handleKeyDown}
          className="cursor-crosshair outline-none"
          style={{
            width: canvasStyle.width || '100%',
            height: canvasStyle.height || '100%',
            imageRendering: 'auto',
            display: 'block',
          }}
        />
      </div>

      {/* Disconnected overlay */}
      {status === 'disconnected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="text-center">
            <div className="text-red-400 text-lg font-medium mb-2">Disconnected</div>
            <div className="text-gray-400 text-sm">Reconnecting...</div>
          </div>
        </div>
      )}
    </div>
  );
}
