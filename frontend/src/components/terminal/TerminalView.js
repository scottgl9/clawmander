import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

const STATUS = { connecting: 'connecting', connected: 'connected', disconnected: 'disconnected' };

export default function TerminalView() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState(STATUS.connecting);

  const connect = useCallback(() => {
    if (!mountedRef.current || !termRef.current) return;

    const fitAddon = fitAddonRef.current;
    const term = termRef.current;

    setStatus(STATUS.connecting);

    const cols = term.cols;
    const rows = term.rows;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal?cols=${cols}&rows=${rows}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus(STATUS.connected);
      reconnectDelay.current = 1000;
      // Re-fit in case the container resized while disconnected
      fitAddon.fit();
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'output') {
        term.write(msg.data);
      } else if (msg.type === 'exit') {
        term.writeln(`\r\n\x1b[33mProcess exited with code ${msg.exitCode}\x1b[0m`);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus(STATUS.disconnected);
      // Reconnect with backoff
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 10000);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f1117',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        selectionBackground: '#3b3b5c',
        black: '#1a1b26',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#c0caf5',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);
    fitAddon.fit();

    // Send user input to backend
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Resize handler
    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    ro.observe(containerRef.current);

    // Connect
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
      ro.disconnect();
      term.dispose();
    };
  }, [connect]);

  const statusColor = {
    [STATUS.connecting]: 'text-yellow-400',
    [STATUS.connected]: 'text-green-400',
    [STATUS.disconnected]: 'text-red-400',
  }[status];

  const statusLabel = {
    [STATUS.connecting]: 'Connecting...',
    [STATUS.connected]: 'Connected',
    [STATUS.disconnected]: 'Disconnected',
  }[status];

  return (
    <div className="flex flex-col h-full" style={{ background: '#0f1117' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-sm text-gray-400 font-medium">Terminal</span>
        <span className={`text-xs ${statusColor} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === STATUS.connected ? 'bg-green-400' :
            status === STATUS.connecting ? 'bg-yellow-400' : 'bg-red-400'
          }`} />
          {statusLabel}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" style={{ padding: '4px 0 0 4px' }} />
    </div>
  );
}
