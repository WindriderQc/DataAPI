const { storageScan } = require('../src/jobs/storageScan');
const { logEvent } = require('../utils/eventLogger');

const scan = async (req, res, next) => {
  const { roots, extensions, emit_every, max_concurrency } = req.body;

  if (!roots || !extensions) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: roots, extensions'
    });
  }

  const db = req.app.locals.dbs.mainDb;
  const scan_id = "scan:" + Date.now();

  const emit = async (event) => {
    try {
      await db.collection('events').insertOne(event);
      logEvent(event.type, 'info', { meta: event.payload });
    } catch (e) {
      console.error('Failed to emit event:', e);
    }
  };

  storageScan({ roots, extensions, emitEvery: emit_every }, { db, emit, scan_id });

  res.json({
    job_id: scan_id
  });
};

module.exports = {
  scan
};