class SSEManager {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders();
    res.write('data: {"type":"connected"}\n\n');
    if (typeof res.flush === 'function') res.flush();
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(payload);
      if (typeof client.flush === 'function') client.flush();
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

module.exports = SSEManager;
