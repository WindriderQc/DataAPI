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

const getStatus = async (req, res, next) => {
  const { scan_id } = req.params;

  if (!scan_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required parameter: scan_id'
    });
  }

  const db = req.app.locals.dbs.mainDb;

  try {
    const scanDoc = await db.collection('nas_scans').findOne({ _id: scan_id });

    if (!scanDoc) {
      return res.status(404).json({
        status: 'error',
        message: `Scan not found: ${scan_id}`
      });
    }

    res.json({
      status: 'success',
      data: {
        scan_id: scanDoc._id,
        status: scanDoc.status,
        counts: scanDoc.counts,
        started_at: scanDoc.started_at,
        finished_at: scanDoc.finished_at,
        errors: scanDoc.errors
      }
    });
  } catch (e) {
    console.error('Failed to get scan status:', e);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  scan,
  getStatus
};