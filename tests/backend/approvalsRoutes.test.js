const express = require('express');
const http = require('http');
const approvalsRoutes = require('../../backend/routes/approvals');

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json' },
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }).on('error', (err) => { server.close(); reject(err); });
    });
  });
}

function createMockCLI(config = {}, approvalsData = {}) {
  return {
    readConfig: jest.fn().mockResolvedValue(config),
    configSetGlobal: jest.fn().mockResolvedValue(''),
    _execGlobal: jest.fn().mockResolvedValue(JSON.stringify(approvalsData)),
  };
}

function createApp(cli) {
  const app = express();
  app.use(express.json());
  app.use('/api/approvals', approvalsRoutes(cli));
  return app;
}

describe('Approvals Routes', () => {
  test('GET /api/approvals returns defaults and agents', async () => {
    const config = {
      tools: { exec: { security: 'allowlist', ask: 'on-miss' } },
      agents: { list: [{ id: 'agent-1', name: 'Agent 1', tools: { exec: { security: 'full' } } }] },
    };
    const approvalsData = {
      file: { agents: { 'agent-1': { allowlist: [{ id: 'e1', pattern: 'npm *' }] } } },
    };
    const cli = createMockCLI(config, approvalsData);
    const app = createApp(cli);

    const res = await get(app, '/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.defaults.security).toBe('allowlist');
    expect(res.body.agents).toHaveLength(1);
    expect(res.body.agents[0].security).toBe('full');
    expect(res.body.agents[0].allowlist).toHaveLength(1);
  });

  test('GET /api/approvals returns empty when no config', async () => {
    const cli = createMockCLI({}, {});
    const app = createApp(cli);

    const res = await get(app, '/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(0);
  });

  test('PUT /api/approvals/defaults updates settings', async () => {
    const cli = createMockCLI();
    const app = createApp(cli);

    const res = await request(app, 'PUT', '/api/approvals/defaults', { security: 'full', ask: 'always' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(cli.configSetGlobal).toHaveBeenCalledWith('tools.exec.security', 'full');
    expect(cli.configSetGlobal).toHaveBeenCalledWith('tools.exec.ask', 'always');
  });

  test('PUT /api/approvals/agents/:id updates per-agent security', async () => {
    const config = { agents: { list: [{ id: 'agent-1', name: 'Agent 1' }] } };
    const cli = createMockCLI(config);
    const app = createApp(cli);

    const res = await request(app, 'PUT', '/api/approvals/agents/agent-1', { security: 'deny' });
    expect(res.status).toBe(200);
    expect(cli.configSetGlobal).toHaveBeenCalledWith(
      'agents.list[0].tools.exec',
      JSON.stringify({ security: 'deny' }),
      true
    );
  });

  test('PUT /api/approvals/agents/:id returns 404 for unknown agent', async () => {
    const cli = createMockCLI({ agents: { list: [] } });
    const app = createApp(cli);

    const res = await request(app, 'PUT', '/api/approvals/agents/unknown', { security: 'full' });
    expect(res.status).toBe(404);
  });

  test('POST /api/approvals/agents/:id/allowlist adds pattern', async () => {
    const cli = createMockCLI();
    const app = createApp(cli);

    const res = await request(app, 'POST', '/api/approvals/agents/agent-1/allowlist', { pattern: 'npm run *' });
    expect(res.status).toBe(201);
    expect(cli._execGlobal).toHaveBeenCalledWith(['approvals', 'allowlist', 'add', '--agent', 'agent-1', 'npm run *']);
  });

  test('POST /api/approvals/agents/:id/allowlist returns 400 without pattern', async () => {
    const cli = createMockCLI();
    const app = createApp(cli);

    const res = await request(app, 'POST', '/api/approvals/agents/agent-1/allowlist', {});
    expect(res.status).toBe(400);
  });

  test('DELETE /api/approvals/agents/:id/allowlist/:entryId removes entry', async () => {
    const approvalsData = {
      file: { agents: { 'agent-1': { allowlist: [{ id: 'entry-1', pattern: 'npm *' }] } } },
    };
    const cli = createMockCLI({}, approvalsData);
    const app = createApp(cli);

    const res = await request(app, 'DELETE', '/api/approvals/agents/agent-1/allowlist/entry-1');
    expect(res.status).toBe(200);
    expect(cli._execGlobal).toHaveBeenCalledWith(['approvals', 'allowlist', 'remove', '--agent', 'agent-1', 'npm *']);
  });

  test('DELETE /api/approvals/agents/:id/allowlist/:entryId returns 404 for unknown entry', async () => {
    const approvalsData = { file: { agents: {} } };
    const cli = createMockCLI({}, approvalsData);
    const app = createApp(cli);

    const res = await request(app, 'DELETE', '/api/approvals/agents/agent-1/allowlist/nonexistent');
    expect(res.status).toBe(404);
  });
});
