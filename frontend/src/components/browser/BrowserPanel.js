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
  const touchStartRef = useRef(null);
  const lastTouchRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [keyboardActive, setKeyboardActive] = useState(false);

  const {
    status,
    url,
    controlMode,
    agentMessage,
    agentChecklist,
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
    sendKeyboardAction,
    takeControl,
    releaseControl,
    pages,
    activePageId,
    switchPage,
    closePage,
    lastClickInfo,
    inputBlocked,
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
  }, [getNormalizedCoords, sendClick]);

  // Touch support for mobile — scroll + tap-to-click
  const scrollSensitivity = 3;

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    const point = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchStartRef.current = point;
    lastTouchRef.current = point;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 0 || !lastTouchRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = lastTouchRef.current.y - touch.clientY;
    if (Math.abs(deltaY) > 2) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const normX = (touch.clientX - rect.left) / rect.width;
        const normY = (touch.clientY - rect.top) / rect.height;
        sendScroll(normX, normY, deltaY * scrollSensitivity);
      }
    }
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  }, [sendScroll, scrollSensitivity]);

  const handleTouchEnd = useCallback((e) => {
    if (e.changedTouches.length === 0 || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const start = touchStartRef.current;
    const elapsed = Date.now() - start.time;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Only fire click for short taps with minimal movement
    if (elapsed < 300 && distance < 10) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;
        sendClick(x, y);
      }
    }
    touchStartRef.current = null;
    lastTouchRef.current = null;
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
          onClick={() => {
            if (keyboardActive) {
              hiddenInputRef.current?.blur();
            } else {
              hiddenInputRef.current?.focus();
            }
          }}
          className={`p-1.5 rounded hover:text-white hover:bg-surface-lighter transition-colors sm:hidden ${keyboardActive ? 'text-blue-400' : 'text-gray-400'}`}
          title={keyboardActive ? 'Hide Keyboard' : 'Show Keyboard'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="4" width="20" height="14" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
          </svg>
        </button>

        {/* Tab+Enter quick action */}
        <button
          onClick={() => sendKeyboardAction('tab-enter', { tabCount: 1 })}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors text-xs"
          title="Press Tab + Enter (keyboard fallback for buttons)"
        >
          Tab+Enter
        </button>

        {/* Control badge */}
        <ControlBadge mode={controlMode} onToggle={handleControlToggle} />

        {/* Connection status */}
        <span className={`text-xs ${statusConf.color} flex items-center gap-1 shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          <span className="hidden sm:inline">{statusConf.label}</span>
        </span>
      </div>

      {/* Page tab bar — shown when multiple pages exist */}
      {pages.length > 1 && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-800 bg-surface-light overflow-x-auto scrollbar-none">
          {pages.map((pg) => {
            const label = pg.title || (() => { try { return new URL(pg.url).hostname; } catch { return pg.url || 'New Tab'; } })();
            const isActive = pg.id === activePageId;
            return (
              <div
                key={pg.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer shrink-0 max-w-[160px] transition-colors ${
                  isActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-gray-400 hover:text-gray-200 hover:bg-surface-lighter'
                }`}
                onClick={() => switchPage(pg.id)}
              >
                <span className="truncate">{label}</span>
                {pages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closePage(pg.id); }}
                    className="ml-0.5 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                    title="Close tab"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agent message banner */}
      <AgentMessageBanner message={agentMessage} checklist={agentChecklist} onRelease={releaseControl} />

      {/* Input blocked toast */}
      {inputBlocked && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-sm text-red-300">
            <span>{inputBlocked.reason}</span>
            <button
              onClick={takeControl}
              className="px-2 py-1 text-xs font-medium rounded bg-red-500/30 text-red-200 hover:bg-red-500/50 transition-colors whitespace-nowrap"
            >
              Take Control
            </button>
          </div>
        </div>
      )}

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
        onFocus={() => setKeyboardActive(true)}
        onBlur={() => setKeyboardActive(false)}
        style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0.01 }}
        tabIndex={-1}
      />

      {/* Canvas viewport — fills all remaining space */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ background: '#1a1b26' }}
      >
        <div className="relative" style={{ width: canvasStyle.width || '100%', height: canvasStyle.height || '100%' }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            onClick={handleCanvasClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleCanvasWheel}
            onMouseMove={handleCanvasMouseMove}
            onKeyDown={handleKeyDown}
            className="cursor-crosshair outline-none"
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'auto',
              display: 'block',
              touchAction: 'none',
            }}
          />
          {/* Click marker dot + tooltip */}
          {lastClickInfo?.elementInfo && (
            <div
              className="absolute pointer-events-none animate-ping-once"
              style={{
                left: `${(lastClickInfo.x / viewportSize.width) * 100}%`,
                top: `${(lastClickInfo.y / viewportSize.height) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-3 h-3 rounded-full bg-blue-400/60 border border-blue-300/80" />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/80 text-xs text-gray-200 whitespace-nowrap">
                {lastClickInfo.elementInfo.tag}
                {lastClickInfo.elementInfo.id ? `#${lastClickInfo.elementInfo.id}` : ''}
                {lastClickInfo.elementInfo.text ? ` "${lastClickInfo.elementInfo.text.slice(0, 30)}"` : ''}
              </div>
            </div>
          )}
        </div>
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
