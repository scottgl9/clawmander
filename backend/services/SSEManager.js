const HEARTBEAT_INTERVAL_MS = 15000;

class SSEManager {
  constructor() {
    this.clients = new Set();
    // Map<res, NodeJS.Timeout> — per-connection heartbeat interval
    this._heartbeats = new Map();
  }

  addClient(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders();

    // Disable Node's default idle socket timeout so SSE connections don't
    // get torn down after ~2 minutes of silence.
    try { res.socket?.setTimeout(0); } catch {}

    this._safeWrite(res, 'data: {"type":"connected"}\n\n');

    this.clients.add(res);

    // Per-connection heartbeat: writes an SSE comment frame every 15s.
    // EventSource ignores comment frames but intermediaries/keepalives see traffic.
    const interval = setInterval(() => {
      this._safeWrite(res, ':\n\n');
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof interval.unref === 'function') interval.unref();
    this._heartbeats.set(res, interval);

    res.on('close', () => this._removeClient(res));
  }

  _removeClient(res) {
    const interval = this._heartbeats.get(res);
    if (interval) clearInterval(interval);
    this._heartbeats.delete(res);
    this.clients.delete(res);
  }

  _safeWrite(res, payload) {
    try {
      res.write(payload);
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch (err) {
      // Client write failed (socket closed, etc.) — drop it so we don't
      // crash on the next broadcast.
      this._removeClient(res);
      return false;
    }
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      this._safeWrite(client, payload);
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

module.exports = SSEManager;
