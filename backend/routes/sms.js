const express = require('express');
const anyAuth = require('../middleware/anyAuth');

module.exports = function (smsGatewayService, messageModel) {
  const router = express.Router();

  // List messages
  router.get('/messages', anyAuth, (req, res) => {
    const since = req.query.since || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const contact = req.query.contact || null;
    const type = req.query.type || null;
    const messages = messageModel.list({ since, limit, contact, type });
    res.json(messages);
  });

  // Get single message
  router.get('/messages/:id', anyAuth, (req, res) => {
    const msg = messageModel.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  });

  // Webhook — NO AUTH, called by android-sms-gateway
  router.post('/webhook', (req, res) => {
    const event = req.body?.event || '';
    const data = req.body?.payload || req.body;

    if (event === 'mms:downloaded') {
      const lookupId = data.transactionId || data.messageId;
      const body = data.body || (data.parts?.find?.(p => p.contentType === 'text/plain')?.text) || null;
      const parts = data.parts ? JSON.stringify(data.parts) : null;
      console.log('[SMS] webhook mms:downloaded', {
        lookupId,
        messageId: data.messageId || null,
        transactionId: data.transactionId || null,
        subject: data.subject || null,
        hasBody: !!body,
        partsCount: Array.isArray(data.parts) ? data.parts.length : 0,
      });
      const result = messageModel.updateMmsDownloaded(
        lookupId,
        {
          body,
          parts,
          downloadedAt: data.receivedAt || new Date().toISOString(),
          rawPayload: JSON.stringify(req.body),
        }
      );
      if (!result.updated) {
        console.warn('[SMS] mms:downloaded did not match existing message', {
          lookupId,
          messageId: data.messageId || null,
          transactionId: data.transactionId || null,
          reason: result.reason || 'unknown',
        });
      } else {
        console.log('[SMS] mms:downloaded matched existing message', {
          lookupId,
          matchedId: result.matchedId,
          storedTransactionId: result.storedTransactionId,
          storedMessageId: result.storedMessageId,
        });
      }
      return res.json({ updated: result.updated, matchedId: result.matchedId || null, reason: result.reason || null });
    }

    if (event === 'mms:received' || event === 'sms:received') {
      console.log('[SMS] webhook received', {
        event,
        messageId: data.messageId || null,
        transactionId: data.transactionId || null,
        sender: data.sender || null,
        hasBody: !!data.body,
        subject: data.subject || null,
      });
    }

    const normalized = smsGatewayService.normalizeMessage(req.body);
    const result = messageModel.upsert(normalized);
    res.json({ stored: result.inserted, id: result.id });
  });

  // Manual sync
  router.post('/sync', anyAuth, async (req, res) => {
    const reachable = await smsGatewayService.isReachable();
    let new_messages = 0;
    if (reachable) {
      new_messages = await smsGatewayService.syncFromPhone();
    }
    res.json({ new_messages, reachable });
  });

  // Health — NO AUTH
  router.get('/health', async (req, res) => {
    const reachable = await smsGatewayService.isReachable();
    const message_count = messageModel.count();
    res.json({ reachable, message_count, asg_url: smsGatewayService.asgUrl });
  });

  return router;
};
