const express = require('express');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const SYSTEM_USERNAME = os.userInfo().username;
const { EXEC_SUFFIX_RE, EXEC_ONLY_RE, stripExecSuffix } = require('../lib/execPatterns');
const { dataPath } = require('../storage/dataDir');

// Stable djb2-style hash — used to derive a deterministic message id from
// (sessionKey, index, message content) so React keys stay stable across
// successive history reloads. Using Date.now() here causes bubbles to remount
// on every reload, which resets streaming indicators and scroll position.
function stableGatewayMsgId(sessionKey, index, msg) {
  const role = (msg && msg.role) || '';
  const c = msg && msg.content;
  const contentStr = typeof c === 'string' ? c : (c ? JSON.stringify(c).slice(0, 512) : '');
  const runId = (msg && msg.runId) || '';
  const input = `${sessionKey}|${index}|${role}|${runId}|${contentStr}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return `gw-${(hash >>> 0).toString(36)}`;
}

// Normalize OpenClaw gateway chat.history response into Clawmander message format
function normalizeGatewayHistory(result, sessionKey) {
  const raw = Array.isArray(result) ? result : (result?.messages || result?.items || result?.turns || []);
  return raw
    // Only show user and assistant turns.
    // toolResult / system / tool roles are internal — never shown in the chat UI.
    // Notably, standalone exec notifications arrive as role:"toolResult" toolName:"exec".
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    // For user turns, skip if content is entirely tool_result blocks (file reads, tool outputs)
    .filter((msg) => {
      if (msg.role !== 'user') return true;
      const c = msg.content;
      if (Array.isArray(c)) {
        return c.some((b) => b.type !== 'tool_result');
      }
      return true;
    })
    .map((msg, i) => ({
      id: msg.id || stableGatewayMsgId(sessionKey, i, msg),
      sessionKey,
      role: msg.role || 'assistant',
      content: extractGatewayText(msg),
      runId: msg.runId || null,
      state: 'complete',
      attachments: msg.attachments || [],
      timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
    }))
    // Drop messages with no displayable text (tool-only turns, empty)
    .filter((m) => m.content.trim().length > 0);
}

function extractGatewayText(msg) {
  if (!msg) return '';

  const content = msg.content;

  const isUser = msg.role === 'user';

  // String content
  if (typeof content === 'string') {
    if (looksLikeRawJSON(content)) return '';
    const text = stripUntrustedWrappers(content);
    return isUser ? stripExecSuffix(text) : text;
  }

  // Array of content blocks
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        const cleaned = stripUntrustedWrappers(block.text);
        if (!looksLikeRawJSON(cleaned) && cleaned.trim()) {
          parts.push(isUser ? stripExecSuffix(cleaned) : cleaned);
        }
      } else if (block.type === 'tool_use') {
        parts.push(`*Used tool: ${block.name || 'unknown'}*`);
      }
      // Skip tool_result blocks — raw tool output
    }
    return parts.filter(Boolean).join('\n');
  }

  // Object content (single tool result or unexpected shape) — skip
  if (typeof content === 'object' && content !== null) return '';

  if (msg.text) return stripUntrustedWrappers(msg.text);
  return '';
}

// Detect raw JSON blobs (tool output like web search results)
function looksLikeRawJSON(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try { JSON.parse(t); return true; } catch { return false; }
  }
  return false;
}

// Strip <<<EXTERNAL_UNTRUSTED_CONTENT id="...">>> ... <<<END_EXTERNAL_UNTRUSTED_CONTENT id="...">>>
// wrapper tags, keeping the inner text. Also strip "Source: Web Search\n---\n" headers.
function stripUntrustedWrappers(text) {
  if (!text) return '';
  return text
    .replace(/<<<EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>\n?/g, '')
    .replace(/<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '')
    .replace(/^Source:\s*\S+\n---\n/gm, '')
    .trim();
}

module.exports = function (chatGatewayClient, chatService) {
  const router = express.Router();

  // Lazy-load multer to avoid crash if not installed yet
  let upload;
  function getUpload() {
    if (!upload) {
      try {
        const multer = require('multer');
        const uploadDir = dataPath('uploads');
        upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });
      } catch (e) {
        return null;
      }
    }
    return upload;
  }

  // GET /api/chat/agents — returns known agents with live isWorking state
  // Derived from gateway start/end/agent-lifecycle events, not agents.list RPC (which has no activity data)
  router.get('/agents', (req, res) => {
    const agents = chatGatewayClient.getAgentStatuses();
    res.json({ agents, connected: chatGatewayClient.connected });
  });

  // GET /api/chat/sessions
  router.get('/sessions', async (req, res) => {
    try {
      if (!chatGatewayClient.connected) {
        return res.json({ sessions: [], connected: false });
      }
      const result = await chatGatewayClient.listSessions({ includeGlobal: false });
      const sessions = Array.isArray(result) ? result : (result?.sessions || result?.items || []);
      res.json({ sessions, connected: true });
    } catch (err) {
      console.error('[Chat] sessions list error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/sessions/:key/reset
  router.post('/sessions/:key/reset', async (req, res) => {
    try {
      const { reason = 'new' } = req.body;
      const result = await chatGatewayClient.resetSession(req.params.key, reason);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/sessions/:key/patch
  router.post('/sessions/:key/patch', async (req, res) => {
    try {
      const result = await chatGatewayClient.patchSession(req.params.key, req.body);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/models
  router.get('/models', async (req, res) => {
    try {
      if (!chatGatewayClient.connected) {
        return res.json({ models: [], connected: false });
      }
      const result = await chatGatewayClient.listModels();
      const models = Array.isArray(result) ? result : (result?.models || result?.items || []);
      res.json({ models, connected: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/send
  router.post('/send', async (req, res) => {
    const { sessionKey, message, attachments } = req.body;
    if (!sessionKey || !message) {
      return res.status(400).json({ error: 'sessionKey and message are required' });
    }
    try {
      // Transform file-upload attachments: read from disk and base64-encode so the
      // gateway receives self-contained image data rather than a local URL it can't fetch.
      const fs = require('fs');
      const MEDIA_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      const uploadDir = dataPath('uploads');

      const resolvedAttachments = await Promise.all((attachments || []).map(async (att) => {
        const match = att.url && att.url.match(/^\/api\/chat\/uploads\/([^/]+)$/);
        if (!match) return att;
        const filename = match[1];
        const ext = (att.originalname || '').split('.').pop().toLowerCase();
        const mediaType = MEDIA_TYPES[ext] || 'application/octet-stream';
        try {
          const data = fs.readFileSync(path.join(uploadDir, filename)).toString('base64');
          return { ...att, type: 'image', mediaType, data };
        } catch {
          return att;
        }
      }));

      const result = await chatService.send(sessionKey, message, resolvedAttachments);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[Chat] send error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/abort
  router.post('/abort', async (req, res) => {
    const { sessionKey, runId } = req.body;
    if (!sessionKey) {
      return res.status(400).json({ error: 'sessionKey is required' });
    }
    try {
      await chatGatewayClient.abortRun(sessionKey, runId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/history/:sessionKey
  // Fetches from gateway if connected (source of truth), falls back to local store
  router.get('/history/:sessionKey', async (req, res) => {
    const sessionKey = req.params.sessionKey;

    if (chatGatewayClient.connected) {
      try {
        const result = await chatGatewayClient.getHistory(sessionKey, 300);
        const messages = normalizeGatewayHistory(result, sessionKey);

        // Check if there's an active run for this session
        let activeRunId = null;
        const agents = chatGatewayClient.getAgentStatuses();
        const activeAgent = agents.find((a) => a.isWorking && a.sessionKey === sessionKey);
        if (activeAgent) activeRunId = activeAgent.runId || null;

        return res.json({ messages, source: 'gateway', activeRunId });
      } catch (err) {
        console.warn('[Chat] Gateway history failed, using local:', err.message);
      }
    }

    const messages = chatService.getHistory(sessionKey);
    res.json({ messages, source: 'local', activeRunId: null });
  });

  // POST /api/chat/approval/resolve
  router.post('/approval/resolve', async (req, res) => {
    const { approvalId, decision } = req.body;
    if (!approvalId || !decision) {
      return res.status(400).json({ error: 'approvalId and decision are required' });
    }
    try {
      const result = await chatGatewayClient.resolveApproval(approvalId, decision);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/upload  (image upload)
  router.post('/upload', (req, res) => {
    const up = getUpload();
    if (!up) {
      return res.status(501).json({ error: 'multer not installed; run: npm install multer' });
    }
    up.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const url = `/api/chat/uploads/${req.file.filename}`;
      res.json({ ok: true, url, filename: req.file.filename, originalname: req.file.originalname });
    });
  });

  return router;
};

module.exports.stableGatewayMsgId = stableGatewayMsgId;
