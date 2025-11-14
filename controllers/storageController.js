const { Scanner } = require('../src/jobs/scanner/scan');
const { ObjectId } = require('mongodb');
const { triggers } = require('../utils/n8nWebhook');

// Track running scans so they can be stopped
const runningScans = new Map();

const scan = async (req, res, next) => {
  try {
    const { roots, extensions, batch_size } = req.body;

    if (!roots || !extensions) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: roots, extensions'
      });
    }

    if (!Array.isArray(roots) || roots.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'roots must be a non-empty array'
      });
    }

    if (!Array.isArray(extensions) || extensions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'extensions must be a non-empty array'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    const scan_id = new ObjectId().toHexString();

    const scanner = new Scanner(db);
    
    // Track the running scan
    runningScans.set(scan_id, scanner);
    
    // Auto-cleanup when scan completes
    scanner.on('done', async () => {
      runningScans.delete(scan_id);
      
      // Trigger n8n webhook when scan completes
      try {
        const scanDoc = await db.collection('nas_scans').findOne({ _id: scan_id });
        if (scanDoc) {
          await triggers.scanComplete({
            scanId: scan_id,
            status: scanDoc.status,
            filesFound: scanDoc.counts?.files_seen || 0,
            upserts: scanDoc.counts?.upserts || 0,
            errors: scanDoc.counts?.errors || 0,
            duration: scanDoc.finished_at && scanDoc.started_at 
              ? new Date(scanDoc.finished_at) - new Date(scanDoc.started_at)
              : null,
            roots: scanDoc.roots
          });
        }
      } catch (webhookError) {
        // Don't fail the scan if webhook fails
        console.error('Failed to trigger n8n webhook:', webhookError);
      }
    });
    
    // Start the scan (fire and forget)
    scanner.run({ 
      roots, 
      includeExt: extensions,
      batchSize: batch_size || 1000,
      scanId: scan_id
    });

    res.json({
      status: 'success',
      message: 'Scan started successfully',
      data: {
        scan_id,
        roots,
        extensions,
        batch_size: batch_size || 1000
      }
    });
  } catch (error) {
    console.error('Error starting scan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to start scan',
      error: error.message
    });
  }
};

const getStatus = async (req, res, next) => {
  try {
    const { scan_id } = req.params;

    if (!scan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: scan_id'
      });
    }

    const db = req.app.locals.dbs.mainDb;
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
        live: runningScans.has(scan_id), // Indicate if scan is actively running
        counts: scanDoc.counts,
        roots: scanDoc.roots,
        started_at: scanDoc.started_at,
        finished_at: scanDoc.finished_at,
        last_error: scanDoc.last_error
      }
    });
  } catch (error) {
    console.error('Failed to get scan status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve scan status',
      error: error.message
    });
  }
};

const stopScan = async (req, res, next) => {
  try {
    const { scan_id } = req.params;

    if (!scan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: scan_id'
      });
    }

    const scanner = runningScans.get(scan_id);
    
    if (!scanner) {
      return res.status(404).json({
        status: 'error',
        message: 'Scan not running or already completed'
      });
    }

    scanner.stop();
    
    res.json({
      status: 'success',
      message: 'Stop request sent to scan',
      data: {
        scan_id
      }
    });
  } catch (error) {
    console.error('Failed to stop scan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to stop scan',
      error: error.message
    });
  }
};

const listScans = async (req, res, next) => {
  try {
    const { limit = 10, skip = 0 } = req.query;
    const db = req.app.locals.dbs.mainDb;
    
    const scans = await db.collection('nas_scans')
      .find({})
      .sort({ started_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();
    
    // Add live indicator to each scan
    const scansWithLive = scans.map(scan => ({
      ...scan,
      live: runningScans.has(scan._id),
      duration: scan.finished_at && scan.started_at 
        ? Math.round((new Date(scan.finished_at) - new Date(scan.started_at)) / 1000)
        : null
    }));
    
    res.json({
      status: 'success',
      data: {
        scans: scansWithLive,
        count: scansWithLive.length
      }
    });
  } catch (error) {
    console.error('Failed to list scans:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve scans list',
      error: error.message
    });
  }
};

const getDirectoryCount = async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const directories = db.collection('nas_directories');
    
    const count = await directories.countDocuments();
    
    res.json({
      status: 'success',
      data: {
        count
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scan,
  getStatus,
  stopScan,
  listScans,
  getDirectoryCount
};