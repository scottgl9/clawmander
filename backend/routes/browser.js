const express = require('express');
const { WebSocketServer } = require('ws');
const anyAuth = require('../middleware/anyAuth');

function browserRoutes(browserManager) {
  const router = express.Router();

  // List all instances
  router.get('/', anyAuth, (req, res) => {
    res.json(browserManager.listInstances());
  });

  // Create instance
  router.post('/', anyAuth, async (req, res) => {
    const id = req.body.id || `browser-${Date.now()}`;
    try {
      const instance = await browserManager.createInstance(id, req.body);
      res.status(201).json(instance.getInfo());
    } catch (err) {
      if (err.code === 'DUPLICATE') return res.status(409).json({ error: err.message });
      if (err.code === 'MAX_INSTANCES') return res.status(429).json({ error: err.message });
      console.error('[Browser] Create error:', err);
      res.status(500).json({ error: 'Failed to create browser instance' });
    }
  });

  // Get instance detail
  router.get('/:id', anyAuth, (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    res.json(instance.getInfo());
  });

  // Destroy instance
  router.delete('/:id', anyAuth, async (req, res) => {
    const destroyed = await browserManager.destroyInstance(req.params.id);
    if (!destroyed) return res.status(404).json({ error: 'Instance not found' });
    res.json({ ok: true });
  });

  // Navigate
  router.post('/:id/navigate', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.navigate(req.body.url);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Click
  router.post('/:id/click', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      if (req.body.selector) {
        await instance.clickSelector(req.body.selector);
      } else {
        await instance.click(req.body.x, req.body.y);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Type
  router.post('/:id/type', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      await instance.type(req.body.text);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Press key
  router.post('/:id/key', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      await instance.pressKey(req.body.key);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Scroll
  router.post('/:id/scroll', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      await instance.scroll(req.body.x, req.body.y, req.body.delta);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Screenshot
  router.post('/:id/screenshot', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.screenshot();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Evaluate JavaScript
  router.post('/:id/evaluate', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.evaluate(req.body.script);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get page content
  router.post('/:id/content', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.getPageContent(req.body.selector);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Wait for selector
  router.post('/:id/wait', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.waitForSelector(req.body.selector, req.body.timeout);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Set control mode
  router.post('/:id/control', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    instance.setControlMode(req.body.mode, req.body.reason);
    res.json({ ok: true, mode: req.body.mode });
  });

  // Request user control (blocks until user releases)
  router.post('/:id/request-user-control', anyAuth, async (req, res) => {
    const instance = browserManager.getInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    try {
      const result = await instance.requestUserControl(req.body.reason);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function attachBrowserWS(httpServer, browserManager) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/ws\/browser\/(.+)$/);
    if (!match) return; // Let other upgrade handlers (e.g. terminal) handle it

    const instanceId = match[1];

    wss.handleUpgrade(req, socket, head, (ws) => {
      const instance = browserManager.getInstance(instanceId);
      if (!instance) {
        ws.close(4004, 'Instance not found');
        return;
      }

      instance.addViewer(ws);

      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        // Drop user input if control mode is 'agent'
        if (instance.controlMode === 'agent') {
          if (['click', 'type', 'key', 'scroll', 'mousemove'].includes(msg.type)) {
            return;
          }
        }

        switch (msg.type) {
          case 'navigate':
            instance.navigate(msg.url).catch(() => {});
            break;
          case 'back':
            instance.goBack().catch(() => {});
            break;
          case 'forward':
            instance.goForward().catch(() => {});
            break;
          case 'reload':
            instance.reload().catch(() => {});
            break;
          case 'click':
            instance.click(
              msg.x * instance.viewportSize.width,
              msg.y * instance.viewportSize.height,
            ).catch(() => {});
            break;
          case 'type':
            instance.type(msg.text).catch(() => {});
            break;
          case 'key':
            instance.pressKey(msg.key).catch(() => {});
            break;
          case 'scroll':
            instance.scroll(
              msg.x * instance.viewportSize.width,
              msg.y * instance.viewportSize.height,
              msg.delta,
            ).catch(() => {});
            break;
          case 'mousemove':
            instance.page.mouse.move(
              msg.x * instance.viewportSize.width,
              msg.y * instance.viewportSize.height,
            ).catch(() => {});
            break;
          case 'take-control':
            instance.setControlMode('user');
            break;
          case 'release-control':
            instance.releaseToAgent();
            break;
        }
      });

      ws.on('close', () => {
        instance.removeViewer(ws);
      });

      ws.on('error', () => {
        instance.removeViewer(ws);
      });
    });
  });

  return wss;
}

module.exports = { browserRoutes, attachBrowserWS };
