const { Scanner } = require('../src/jobs/scanner/scan');
const { ObjectId } = require('mongodb');

// Track running scans so they can be stopped
const runningScans = new Map();

// Cleanup stale "running" scans on module load (server restart)
async function cleanupStaleScansFn(db) {
  try {
    const result = await db.collection('nas_scans').updateMany(
      { status: 'running' },
      { 
        $set: { 
          status: 'stopped',
          finished_at: new Date()
        } 
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Storage] Cleaned up ${result.modifiedCount} stale running scan(s) from previous session`);
    }
  } catch (error) {
    console.error('[Storage] Error cleaning up stale scans:', error);
  }
}

// Export cleanup function to be called during app initialization
const cleanupStaleScans = cleanupStaleScansFn;

const scan = async (req, res, next) => {
  try {
    const { roots, extensions, batch_size, compute_hashes, hash_max_size } = req.body;

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
      
      // NOTE: n8n webhook integration moved to AgentX
      // If you need to trigger n8n workflows on scan completion,
      // configure AgentX to poll the scan status or use DataAPI webhooks
    });
    
    // Start the scan (fire and forget)
    scanner.run({ 
      roots, 
      includeExt: extensions,
      batchSize: batch_size || 1000,
      scanId: scan_id,
      // Hashing options for Datalake Janitor deduplication
      computeHashes: compute_hashes === true,
      hashMaxSize: hash_max_size || 100 * 1024 * 1024 // Default: 100MB
    });

    res.json({
      status: 'success',
      message: 'Scan started successfully',
      data: {
        scan_id,
        roots,
        extensions,
        batch_size: batch_size || 1000,
        compute_hashes: compute_hashes === true,
        hash_max_size: hash_max_size || 100 * 1024 * 1024
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
        _id: scanDoc._id,
        status: scanDoc.status,
        live: runningScans.has(scan_id), // Indicate if scan is actively running
        counts: scanDoc.counts,
        config: scanDoc.config || {
          roots: scanDoc.roots || [],
          extensions: [],
          batch_size: null
        },
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
  getDirectoryCount,
  cleanupStaleScans
};