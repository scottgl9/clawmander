const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

function attachTerminalWS(httpServer, terminalService) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const cols = parseInt(url.searchParams.get('cols')) || 80;
    const rows = parseInt(url.searchParams.get('rows')) || 24;
    const sessionId = uuidv4();

    const ptyProcess = terminalService.createSession(sessionId, cols, rows);

    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', exitCode }));
        ws.close();
      }
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.type === 'input') {
        terminalService.writeToSession(sessionId, msg.data);
      } else if (msg.type === 'resize') {
        terminalService.resizeSession(sessionId, msg.cols, msg.rows);
      }
    });

    ws.on('close', () => {
      terminalService.destroySession(sessionId);
    });

    ws.on('error', () => {
      terminalService.destroySession(sessionId);
    });
  });

  return wss;
}

module.exports = { attachTerminalWS };
