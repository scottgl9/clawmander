const express = require('express');
const { requireAuth } = require('../middleware/auth');

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/>\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\d+\.\s+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

module.exports = function(config) {
  const router = express.Router();
  const chatterboxUrl = config.chatterbox?.url || 'http://localhost:8400';

  // POST /tts — proxy text to Chatterbox TTS and stream audio back
  router.post('/tts', requireAuth, async (req, res) => {
    const { text, voice, model, chatterboxUrl: urlOverride } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const cleaned = stripMarkdown(text);
    if (!cleaned) return res.status(400).json({ error: 'No speakable text after stripping markdown' });

    const targetUrl = urlOverride || chatterboxUrl;

    try {
      const upstream = await fetch(`${targetUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: cleaned,
          model: model || 'chatterbox',
          voice: voice || 'default',
        }),
      });

      if (!upstream.ok) {
        const msg = await upstream.text().catch(() => 'TTS upstream error');
        return res.status(upstream.status).json({ error: msg });
      }

      // Forward content type and stream bytes
      const contentType = upstream.headers.get('content-type') || 'audio/wav';
      res.setHeader('Content-Type', contentType);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      // Stream the response body
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({ error: `TTS service unavailable: ${err.message}` });
      }
    }
  });

  // GET /tts/status — check if Chatterbox is reachable
  router.get('/tts/status', requireAuth, async (_req, res) => {
    try {
      const upstream = await fetch(`${chatterboxUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      res.json({ available: upstream.ok });
    } catch {
      res.json({ available: false });
    }
  });

  return router;
};
