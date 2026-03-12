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
  const [urlInput, setUrlInput] = useState('');

  const {
    status,
    url,
    controlMode,
    agentMessage,
    navigate,
    sendClick,
    sendKey,
    sendScroll,
    sendMouseMove,
    takeControl,
    releaseControl,
  } = useBrowser(instanceId, canvasRef);

  // Sync URL bar with actual URL
  useEffect(() => {
    setUrlInput(url);
  }, [url]);

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
    e.preventDefault();
    // Map common keys
    const keyMap = {
      Enter: 'Enter',
      Backspace: 'Backspace',
      Tab: 'Tab',
      Escape: 'Escape',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
      Delete: 'Delete',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
    };

    if (keyMap[e.key]) {
      sendKey(keyMap[e.key]);
    } else if (e.key.length === 1) {
      sendKey(e.key);
    }
  }, [sendKey]);

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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-surface-light">
        {/* Navigation buttons */}
        <button
          onClick={() => sendKey('Alt+ArrowLeft')}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <button
          onClick={() => sendKey('Alt+ArrowRight')}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Forward"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
        <button
          onClick={() => sendKey('F5')}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
          title="Reload"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* URL bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter URL..."
            className="w-full px-3 py-1.5 text-sm bg-surface-lighter border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </form>

        {/* Control badge */}
        <ControlBadge mode={controlMode} onToggle={handleControlToggle} />

        {/* Connection status */}
        <span className={`text-xs ${statusConf.color} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          {statusConf.label}
        </span>
      </div>

      {/* Agent message banner */}
      <AgentMessageBanner message={agentMessage} onRelease={releaseControl} />

      {/* Canvas viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ background: '#1a1b26' }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onClick={handleCanvasClick}
          onWheel={handleCanvasWheel}
          onMouseMove={handleCanvasMouseMove}
          onKeyDown={handleKeyDown}
          className="max-w-full max-h-full cursor-crosshair outline-none"
          style={{ imageRendering: 'auto' }}
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
