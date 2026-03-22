const express = require('express');

module.exports = function approvalsRoutes(openClawCLI) {
  const router = express.Router();

  // GET /api/approvals — combined view of exec config + allowlist
  router.get('/', async (req, res) => {
    try {
      const config = await openClawCLI.readConfig();
      const globalExec = config?.tools?.exec || {};
      const agentsList = config?.agents?.list || [];

      let approvalsData = {};
      try {
        const raw = await openClawCLI._execGlobal(['approvals', 'get', '--json']);
        approvalsData = JSON.parse(raw);
      } catch {}

      const fileData = approvalsData.file || {};
      const approvalsAgents = fileData.agents || {};

      const agents = agentsList.map((agent, idx) => {
        const agentExec = agent.tools?.exec || {};
        const approvalsAgent = approvalsAgents[agent.id || agent.name] || approvalsAgents['*'] || {};
        const toolsAllow = Array.isArray(agent.tools) ? agent.tools : (agent.tools?.allow || []);
        return {
          id: agent.id || agent.name || `agent-${idx}`,
          name: agent.name || agent.id || `Agent ${idx}`,
          security: agentExec.security || globalExec.security || 'allowlist',
          allowlist: approvalsAgent.allowlist || [],
          tools: toolsAllow,
        };
      });

      const wildcardAllowlist = approvalsAgents['*']?.allowlist || [];

      res.json({
        defaults: {
          security: globalExec.security || 'allowlist',
          ask: globalExec.ask || 'on-miss',
        },
        agents,
        wildcardAllowlist,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/approvals/defaults — update global exec settings
  router.put('/defaults', async (req, res) => {
    try {
      const { security, ask } = req.body;
      if (security) await openClawCLI.configSetGlobal('tools.exec.security', security);
      if (ask) await openClawCLI.configSetGlobal('tools.exec.ask', ask);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/approvals/agents/:id — update per-agent exec security
  router.put('/agents/:id', async (req, res) => {
    try {
      const { security } = req.body;
      const agentId = req.params.id;

      const config = await openClawCLI.readConfig();
      const agentsList = config?.agents?.list || [];
      const idx = agentsList.findIndex((a) => (a.id || a.name) === agentId);
      if (idx === -1) {
        return res.status(404).json({ error: `Agent "${agentId}" not found in config` });
      }

      if (security) {
        await openClawCLI.configSetGlobal(
          `agents.list[${idx}].tools.exec`,
          JSON.stringify({ security }),
          true
        );
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/approvals/agents/:id/allowlist — add allowlist pattern
  router.post('/agents/:id/allowlist', async (req, res) => {
    try {
      const { pattern } = req.body;
      if (!pattern) return res.status(400).json({ error: 'pattern is required' });
      const agentId = req.params.id === '*' ? '*' : req.params.id;
      await openClawCLI._execGlobal(['approvals', 'allowlist', 'add', '--agent', agentId, pattern]);
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/approvals/agents/:id/tools — add a tool to agent's allow list
  router.post('/agents/:id/tools', async (req, res) => {
    try {
      const { tool } = req.body;
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      const agentId = req.params.id;

      const config = await openClawCLI.readConfig();
      const agentsList = config?.agents?.list || [];
      const idx = agentsList.findIndex((a) => (a.id || a.name) === agentId);
      if (idx === -1) return res.status(404).json({ error: `Agent "${agentId}" not found` });

      const agent = agentsList[idx];
      const existing = Array.isArray(agent.tools) ? { allow: agent.tools } : (agent.tools || {});
      const allowList = existing.allow || [];
      if (allowList.includes(tool)) return res.json({ ok: true });

      const updated = { ...existing, allow: [...allowList, tool] };
      await openClawCLI.configSetGlobal(`agents.list[${idx}].tools`, JSON.stringify(updated), true);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/approvals/agents/:id/tools/:tool — remove a tool from agent's allow list
  router.delete('/agents/:id/tools/:tool', async (req, res) => {
    try {
      const agentId = req.params.id;
      const tool = req.params.tool;

      const config = await openClawCLI.readConfig();
      const agentsList = config?.agents?.list || [];
      const idx = agentsList.findIndex((a) => (a.id || a.name) === agentId);
      if (idx === -1) return res.status(404).json({ error: `Agent "${agentId}" not found` });

      const agent = agentsList[idx];
      const existing = Array.isArray(agent.tools) ? { allow: agent.tools } : (agent.tools || {});
      const allowList = (existing.allow || []).filter((t) => t !== tool);

      const updated = { ...existing, allow: allowList };
      await openClawCLI.configSetGlobal(`agents.list[${idx}].tools`, JSON.stringify(updated), true);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/approvals/agents/:id/allowlist/:entryId — remove allowlist pattern
  router.delete('/agents/:id/allowlist/:entryId', async (req, res) => {
    try {
      let approvalsData = {};
      try {
        const raw = await openClawCLI._execGlobal(['approvals', 'get', '--json']);
        approvalsData = JSON.parse(raw);
      } catch {}

      const fileData = approvalsData.file || {};
      const agentId = req.params.id;
      const agentApprovals = fileData.agents?.[agentId] || fileData.agents?.['*'] || {};
      const entry = (agentApprovals.allowlist || []).find((e) => e.id === req.params.entryId);
      if (!entry) {
        return res.status(404).json({ error: 'Allowlist entry not found' });
      }

      const removeAgent = agentId === '*' ? '*' : agentId;
      await openClawCLI._execGlobal(['approvals', 'allowlist', 'remove', '--agent', removeAgent, entry.pattern]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
