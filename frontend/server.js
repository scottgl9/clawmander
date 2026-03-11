const { createServer } = require('http');
const { parse } = require('url');
const { createConnection } = require('net');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, hostname: '0.0.0.0' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  // Proxy WebSocket upgrades for /ws/* to the backend on port 3001
  server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/ws/')) {
      const backend = createConnection({ host: '127.0.0.1', port: 3001 }, () => {
        backend.write(
          `GET ${req.url} HTTP/1.1\r\n` +
          Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n'
        );
        if (head.length > 0) backend.write(head);

        socket.pipe(backend);
        backend.pipe(socket);
      });

      backend.on('error', () => socket.destroy());
      socket.on('error', () => backend.destroy());
    }
  });

  const port = parseInt(process.env.PORT, 10) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);
  });
});
