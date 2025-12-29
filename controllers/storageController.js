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

    // Log event for dashboard
    await db.collection('appevents').insertOne({
      message: `NAS Scan started: ${roots.join(', ')}`,
      type: 'info',
      meta: { scan_id, roots },
      timestamp: new Date()
    }).catch(err => console.error('[Storage] Failed to log scan start event:', err));

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
    const db = req.app.locals.dbs.mainDb;

    const scan = await db.collection('nas_scans').findOne({ _id: scan_id });

    if (!scan) {
      return res.status(404).json({
        status: 'error',
        message: 'Scan not found'
      });
    }

    res.json({
      status: 'success',
      data: scan
    });
  } catch (error) {
    console.error('Error getting scan status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get scan status',
      error: error.message
    });
  }
};

const stopScan = async (req, res, next) => {
  try {
    const { scan_id } = req.params;
    const scanner = runningScans.get(scan_id);

    if (!scanner) {
      return res.status(404).json({
        status: 'error',
        message: 'Running scan not found'
      });
    }

    scanner.stop();
    runningScans.delete(scan_id);

    res.json({
      status: 'success',
      message: 'Scan stop requested'
    });
  } catch (error) {
    console.error('Error stopping scan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to stop scan',
      error: error.message
    });
  }
};

const listScans = async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const scans = await db.collection('nas_scans')
      .find({})
      .sort({ started_at: -1 })
      .limit(50)
      .toArray();

    res.json({
      status: 'success',
      data: scans
    });
  } catch (error) {
    console.error('Error listing scans:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to list scans',
      error: error.message
    });
  }
};

const getDirectoryCount = async (req, res, next) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({
        status: 'error',
        message: 'Path is required'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    const count = await db.collection('nas_files').countDocuments({
      path: { $regex: `^${path}` }
    });

    res.json({
      status: 'success',
      data: {
        path,
        count
      }
    });
  } catch (error) {
    console.error('Error getting directory count:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get directory count',
      error: error.message
    });
  }
};

/**
 * Batch insert files for a specific scan
 * POST /api/v1/storage/scan/:scan_id/batch
 */
const insertBatch = async (req, res, next) => {
  try {
    const { scan_id } = req.params;
    const { files } = req.body;

    if (!scan_id || !Array.isArray(files)) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing scan_id or files array'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    
    // Prepare bulk operations
    const ops = files.map(file => ({
      updateOne: {
        filter: { path: file.path },
        update: { 
          $set: {
            ...file,
            scan_id,
            updated_at: new Date()
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await db.collection('nas_files').bulkWrite(ops);

    res.json({
      status: 'success',
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      }
    });
  } catch (error) {
    console.error('Failed to insert batch:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to insert file batch',
      error: error.message
    });
  }
};

/**
 * Update scan status (used by n8n to mark complete)
 * PATCH /api/v1/storage/scan/:scan_id
 */
const updateScan = async (req, res, next) => {
  try {
    const { scan_id } = req.params;
    const { status, stats, completedAt } = req.body;

    if (!scan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: scan_id'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    
    // Build update object
    const updateFields = {};
    
    if (status) {
      updateFields.status = status;
    }
    
    if (status === 'completed' || completedAt) {
      updateFields.finished_at = completedAt ? new Date(completedAt) : new Date();
    }
    
    if (stats) {
      // Merge stats into counts
      Object.entries(stats).forEach(([key, value]) => {
        updateFields[`counts.${key}`] = value;
      });
    }

    const result = await db.collection('nas_scans').updateOne(
      { _id: scan_id },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Scan not found: ${scan_id}`
      });
    }

    // Trigger n8n webhook if scan completed
    if (status === 'completed' && process.env.N8N_WEBHOOK_URL) {
      const fetch = require('node-fetch');
      fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'scan_complete',
          scan_id,
          stats: stats || {}
        })
      }).catch(err => console.error('[Storage] Failed to trigger n8n webhook:', err.message));

      // Log event for dashboard
      await db.collection('appevents').insertOne({
        message: `NAS Scan completed: ${scan_id}`,
        type: 'success',
        meta: { scan_id, stats },
        timestamp: new Date()
      }).catch(err => console.error('[Storage] Failed to log scan complete event:', err));
    }

    res.json({
      status: 'success',
      message: 'Scan updated',
      data: {
        scan_id,
        updated: updateFields
      }
    });
  } catch (error) {
    console.error('Failed to update scan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update scan',
      error: error.message
    });
  }
};

module.exports = {
  scan,
  getStatus,
  stopScan,
  listScans,
  getDirectoryCount,
  insertBatch,
  updateScan,
  cleanupStaleScans
};
