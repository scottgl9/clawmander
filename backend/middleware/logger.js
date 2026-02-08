const FileStore = require('../storage/FileStore');
const { createActivityLog } = require('../models/ActivityLog');

const activityStore = new FileStore('activity.json');

function activityLogger(req, res, next) {
  if (req.method !== 'GET') {
    const entry = createActivityLog({
      type: 'api',
      action: `${req.method} ${req.originalUrl}`,
      agentId: req.body?.agentId || null,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    activityStore.insert(entry);
  }
  next();
}

module.exports = { activityLogger, activityStore };
