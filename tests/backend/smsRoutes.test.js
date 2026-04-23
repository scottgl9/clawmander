const express = require('express');
const http = require('http');

jest.mock('../../backend/middleware/anyAuth', () => (req, res, next) => next());

const smsRoutes = require('../../backend/routes/sms');

function createMockSmsGatewayService() {
  return {
    isReachable: jest.fn().mockResolvedValue(true),
    syncFromPhone: jest.fn().mockResolvedValue(0),
    normalizeMessage: jest.fn((payload) => ({
      id: payload?.payload?.messageId || payload?.payload?.transactionId || payload?.id || 'fallback-id',
      type: 'mms',
      sender: payload?.payload?.sender || null,
      recipient: payload?.payload?.recipient || null,
      body: payload?.payload?.body || null,
      subject: payload?.payload?.subject || null,
      size: null,
      content_class: null,
      sim_number: null,
      received_at: payload?.payload?.receivedAt || null,
      raw_payload: JSON.stringify(payload),
    })),
  };
}

function createMockMessageModel() {
  return {
    list: jest.fn().mockReturnValue([]),
    getById: jest.fn().mockReturnValue(null),
    upsert: jest.fn().mockReturnValue({ inserted: true, id: 'stored-id' }),
    updateMmsDownloaded: jest.fn().mockReturnValue({ updated: true, matchedId: 'mms-1' }),
    count: jest.fn().mockReturnValue(1),
  };
}

function createApp(smsGatewayService, messageModel) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/sms', smsRoutes(smsGatewayService, messageModel));
  return app;
}

function makeRequest(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const bodyStr = body ? JSON.stringify(body) : null;
      const headers = {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      };
      const options = { hostname: '127.0.0.1', port, path, method, headers };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}

describe('sms routes', () => {
  let smsGatewayService;
  let messageModel;
  let app;

  beforeEach(() => {
    smsGatewayService = createMockSmsGatewayService();
    messageModel = createMockMessageModel();
    app = createApp(smsGatewayService, messageModel);
  });

  it('updates mms download state when payload uses attachments', async () => {
    const payload = {
      event: 'mms:downloaded',
      payload: {
        messageId: 'mms-1',
        sender: '+15551234567',
        recipient: '+15557654321',
        subject: 'photo',
        receivedAt: '2026-04-23T18:00:00Z',
        attachments: [
          {
            partId: 10,
            contentType: 'image/jpeg',
            name: 'image.jpg',
            size: 12345,
            data: 'base64data',
          },
        ],
      },
    };

    const res = await makeRequest(app, 'POST', '/api/sms/webhook', payload);

    expect(res.status).toBe(200);
    expect(messageModel.updateMmsDownloaded).toHaveBeenCalledWith(
      'mms-1',
      expect.objectContaining({
        body: null,
        parts: JSON.stringify(payload.payload.attachments),
        downloadedAt: '2026-04-23T18:00:00Z',
      })
    );
  });

  it('prefers text body from parts-style payload when present', async () => {
    const payload = {
      event: 'mms:downloaded',
      payload: {
        transactionId: 'txn-1',
        receivedAt: '2026-04-23T18:05:00Z',
        parts: [
          { contentType: 'text/plain', text: 'hello from mms' },
          { contentType: 'image/png', name: 'photo.png' },
        ],
      },
    };

    const res = await makeRequest(app, 'POST', '/api/sms/webhook', payload);

    expect(res.status).toBe(200);
    expect(messageModel.updateMmsDownloaded).toHaveBeenCalledWith(
      'txn-1',
      expect.objectContaining({
        body: 'hello from mms',
        parts: JSON.stringify(payload.payload.parts),
        downloadedAt: '2026-04-23T18:05:00Z',
      })
    );
  });
});
