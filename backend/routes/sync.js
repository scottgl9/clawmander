const express = require('express');
const anyAuth = require('../middleware/anyAuth');

module.exports = function (messageModel, genericSyncModel) {
  const router = express.Router();

  router.post('/sms', anyAuth, (req, res) => {
    const items = req.body;
    let count = 0;
    if (Array.isArray(items)) {
      for (const item of items) {
        const normalized = {
          id: String(item.id),
          type: String(item.id).startsWith('mms_') ? 'mms' : 'sms',
          sender: item.type === 1 ? item.address : 'me',
          recipient: item.type === 2 ? item.address : 'me',
          body: item.body,
          received_at: new Date(item.date_ms).toISOString(),
          raw_payload: JSON.stringify(item)
        };
        const result = messageModel.upsert(normalized);
        if (result.inserted) count++;
      }
    }
    res.json({ count, status: 'ok' });
  });

  const genericSync = (type) => {
    return (req, res) => {
      const items = req.body;
      let count = 0;
      if (Array.isArray(items) && items.length > 0) {
        count = genericSyncModel.upsert(type, items);
      }
      res.json({ count, status: 'ok' });
    };
  };

  router.post('/calendar', anyAuth, genericSync('calendar'));
  router.post('/health', anyAuth, genericSync('health'));
  router.post('/location', anyAuth, genericSync('location'));
  router.post('/contacts', anyAuth, genericSync('contacts'));
  router.post('/call-logs', anyAuth, genericSync('call-logs'));
  router.post('/app-usage', anyAuth, genericSync('app-usage'));
  router.post('/media', anyAuth, genericSync('media'));

  return router;
};
