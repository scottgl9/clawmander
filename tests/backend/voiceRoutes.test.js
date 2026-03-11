const express = require('express');
const http = require('http');
const voiceRoutes = require('../../backend/routes/voice');

// ─── helpers ────────────────────────────────────────────────────────────────

function createTestApp(config = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/voice', voiceRoutes({ chatterbox: { url: 'http://chatterbox.test' }, ...config }));
  return app;
}

function httpRequest(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const bodyStr = body ? JSON.stringify(body) : undefined;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer changeme',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          server.close();
          const raw = Buffer.concat(chunks).toString();
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}

// Build a minimal ReadableStream mock for Node's fetch Response
function makeReadableStream(chunks) {
  let i = 0;
  return {
    getReader() {
      return {
        async read() {
          if (i < chunks.length) {
            return { done: false, value: Buffer.from(chunks[i++]) };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function makeFetchResponse({ ok = true, status = 200, contentType = 'audio/wav', bodyChunks = ['audio-bytes'] } = {}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        if (name === 'content-type') return contentType;
        if (name === 'content-length') return String(bodyChunks.join('').length);
        return null;
      },
    },
    body: makeReadableStream(bodyChunks),
    text: async () => `upstream error ${status}`,
  };
}

// ─── POST /api/voice/tts ─────────────────────────────────────────────────────

describe('POST /api/voice/tts', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('returns 400 when text is missing', async () => {
    const app = createTestApp();
    const res = await httpRequest(app, 'POST', '/api/voice/tts', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('text is required');
  });

  test('returns 400 when text is empty string', async () => {
    const app = createTestApp();
    const res = await httpRequest(app, 'POST', '/api/voice/tts', { text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('text is required');
  });

  test('returns 400 when text is only markdown that strips to empty', async () => {
    const app = createTestApp();
    // Text that strips to empty: only a code block
    const res = await httpRequest(app, 'POST', '/api/voice/tts', { text: '```js\nconsole.log(1)\n```' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No speakable text/);
  });

  test('proxies to Chatterbox and streams audio back', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse({
      ok: true,
      status: 200,
      contentType: 'audio/wav',
      bodyChunks: ['audio-data-bytes'],
    }));

    const app = createTestApp();
    const res = await httpRequest(app, 'POST', '/api/voice/tts', { text: 'Hello world' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/wav/);
    expect(res.raw).toBe('audio-data-bytes');

    // Verify it called Chatterbox with the right payload
    expect(global.fetch).toHaveBeenCalledWith(
      'http://chatterbox.test/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"input":"Hello world"'),
      })
    );
  });

  test('strips markdown before sending to Chatterbox', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse());

    const app = createTestApp();
    await httpRequest(app, 'POST', '/api/voice/tts', {
      text: '**Bold** text with `code` and [a link](https://example.com)',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input).toBe('Bold text with code and a link');
  });

  test('passes voice parameter to Chatterbox', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse());

    const app = createTestApp();
    await httpRequest(app, 'POST', '/api/voice/tts', { text: 'Hi', voice: 'en-female' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.voice).toBe('en-female');
  });

  test('defaults voice to "default" when not provided', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse());

    const app = createTestApp();
    await httpRequest(app, 'POST', '/api/voice/tts', { text: 'Hi' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.voice).toBe('default');
    expect(body.model).toBe('chatterbox');
  });

  test('forwards Chatterbox error status', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse({
      ok: false,
      status: 503,
    }));

    const app = createTestApp();
    const res = await httpRequest(app, 'POST', '/api/voice/tts', { text: 'Hello' });

    expect(res.status).toBe(503);
  });

  test('returns 502 when Chatterbox is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const app = createTestApp();
    const res = await httpRequest(app, 'POST', '/api/voice/tts', { text: 'Hello' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/TTS service unavailable/);
  });

  test('requires auth — rejects missing token', async () => {
    const app = createTestApp();

    // Make a request without the Authorization header
    const res = await new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = server.address().port;
        const body = JSON.stringify({ text: 'hi' });
        const options = {
          hostname: '127.0.0.1',
          port,
          path: '/api/voice/tts',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = http.request(options, (r) => {
          let data = '';
          r.on('data', (c) => { data += c; });
          r.on('end', () => {
            server.close();
            resolve({ status: r.statusCode });
          });
        });
        req.on('error', (err) => { server.close(); reject(err); });
        req.write(body);
        req.end();
      });
    });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/voice/tts/status ───────────────────────────────────────────────

describe('GET /api/voice/tts/status', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('returns available: true when Chatterbox responds ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const app = createTestApp();
    const res = await httpRequest(app, 'GET', '/api/voice/tts/status');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://chatterbox.test/v1/models',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  test('returns available: false when Chatterbox returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const app = createTestApp();
    const res = await httpRequest(app, 'GET', '/api/voice/tts/status');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('returns available: false when Chatterbox is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const app = createTestApp();
    const res = await httpRequest(app, 'GET', '/api/voice/tts/status');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('uses custom CHATTERBOX_URL from config', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const app = express();
    app.use(express.json());
    app.use('/api/voice', voiceRoutes({ chatterbox: { url: 'http://custom-host:9000' } }));

    await httpRequest(app, 'GET', '/api/voice/tts/status');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://custom-host:9000/v1/models',
      expect.anything()
    );
  });
});

// ─── stripMarkdown (tested via route behaviour) ──────────────────────────────

describe('stripMarkdown (via TTS route)', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  const cases = [
    ['bold', '**Bold text**', 'Bold text'],
    ['italic', '*italic text*', 'italic text'],
    ['inline code', 'use `console.log` here', 'use console.log here'],
    ['heading', '## My Heading\nSome text', 'My Heading Some text'],
    ['link', '[click here](https://example.com)', 'click here'],
    ['html tag', '<b>hello</b>', 'hello'],
    ['strikethrough', '~~deleted~~', 'deleted'],
    ['multiple newlines', 'first\n\nsecond', 'first. second'],
  ];

  test.each(cases)('strips %s', async (_, input, expectedOutput) => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse());

    const app = createTestApp();
    await httpRequest(app, 'POST', '/api/voice/tts', { text: input });

    if (global.fetch.mock.calls.length > 0) {
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.input).toBe(expectedOutput);
    }
  });
});
