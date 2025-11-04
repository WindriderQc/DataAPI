const { Scanner } = require('../src/jobs/scanner/scan');
const { ObjectId } = require('mongodb');

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
    scanner.on('done', () => {
      runningScans.delete(scan_id);
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

module.exports = {
  scan,
  getStatus,
  stopScan
};