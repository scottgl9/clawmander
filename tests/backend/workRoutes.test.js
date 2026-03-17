const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const workRoutes = require('../../backend/routes/work');

function createTestApp(actionItemService) {
  const app = express();
  app.use(express.json());
  app.use('/api/work', workRoutes(actionItemService));
  return app;
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

const personalItems = [
  { id: '1', title: 'Dentist', category: 'personal', priority: 'medium', done: false },
  { id: '2', title: 'Gym', category: 'personal', priority: 'low', done: true },
];

const workItems = [
  { id: '3', title: 'Review configs', category: 'work', priority: 'high', done: false },
  { id: '4', title: 'Update resume', category: 'work', priority: 'medium', done: false },
];

const allItems = [...personalItems, ...workItems];

function mockService() {
  return {
    getAll: jest.fn((category) => {
      if (category === 'personal') return personalItems;
      if (category === 'work') return workItems;
      return allItems;
    }),
    getPersonal: jest.fn().mockReturnValue(personalItems),
    getWork: jest.fn().mockReturnValue(workItems),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

describe('Work Routes - Action Items', () => {
  test('GET /api/work/action-items returns all items', async () => {
    const svc = mockService();
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/action-items');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(svc.getAll).toHaveBeenCalledWith(undefined);
  });

  test('GET /api/work/action-items?category=personal returns personal only', async () => {
    const svc = mockService();
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/action-items?category=personal');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i) => i.category === 'personal')).toBe(true);
    expect(svc.getAll).toHaveBeenCalledWith('personal');
  });

  test('GET /api/work/action-items/completed returns done items only', async () => {
    const svc = mockService();
    svc.getAll.mockReturnValue(allItems);
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/action-items/completed');

    expect(res.status).toBe(200);
    expect(res.body.every((i) => i.done === true)).toBe(true);
    expect(res.body).toHaveLength(1); // Gym
  });

  test('GET /api/work/action-items/personal returns personal items', async () => {
    const svc = mockService();
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/action-items/personal');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].category).toBe('personal');
    expect(svc.getPersonal).toHaveBeenCalled();
  });

  test('GET /api/work/action-items/work returns work items', async () => {
    const svc = mockService();
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/action-items/work');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].category).toBe('work');
    expect(svc.getWork).toHaveBeenCalled();
  });

  test('GET /api/work/brief returns brief data', async () => {
    const svc = mockService();
    const app = createTestApp(svc);
    const res = await request(app, '/api/work/brief');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('date');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('priorities');
    expect(res.body).toHaveProperty('blockers');
  });

  test('GET /api/work/brief priorities have title and details', async () => {
    // Seed a brief for today so the route returns priorities
    const briefPath = path.join(__dirname, '../../backend/storage/data/daily-brief.json');
    const today = new Date().toISOString().split('T')[0];
    const seededBrief = [{
      id: 'test-brief',
      date: today,
      summary: 'Test brief',
      priorities: [
        { title: 'Review configs', details: 'Audit heartbeat intervals for all agents.' },
        { title: 'Update resume', details: 'Add recent project experience.' },
      ],
      blockers: [],
    }];
    fs.writeFileSync(briefPath, JSON.stringify(seededBrief, null, 2));

    try {
      const svc = mockService();
      const app = createTestApp(svc);
      const res = await request(app, '/api/work/brief');

      expect(res.body.priorities.length).toBeGreaterThan(0);
      for (const p of res.body.priorities) {
        expect(p).toHaveProperty('title');
        expect(p).toHaveProperty('details');
        expect(typeof p.title).toBe('string');
        expect(typeof p.details).toBe('string');
        expect(p.title.length).toBeGreaterThan(0);
        expect(p.details.length).toBeGreaterThan(0);
      }
    } finally {
      // Clean up seeded file
      fs.unlinkSync(briefPath);
    }
  });
});
