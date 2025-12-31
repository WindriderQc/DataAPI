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
  console.log('[Storage] Scan request received:', JSON.stringify(req.body));
  try {
    const { roots, extensions, batch_size, compute_hashes, hash_max_size } = req.body;
    
    console.log('[Storage] Checking app.locals.dbs...');
    if (!req.app.locals.dbs) {
      console.error('[Storage] req.app.locals.dbs is UNDEFINED');
      throw new Error('Database configuration missing in app.locals');
    }
    
    const db = req.app.locals.dbs.mainDb;
    if (!db) {
      console.error('[Storage] req.app.locals.dbs.mainDb is UNDEFINED');
      throw new Error('Main database handle missing');
    }
    console.log('[Storage] DB handle acquired:', db.databaseName || 'unknown');

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

    const scan_id = new ObjectId().toHexString();

    const scanner = new Scanner(db);
    
    // Track the running scan
    runningScans.set(scan_id, scanner);
    
    // Auto-cleanup when scan completes
    scanner.on('done', async () => {
      runningScans.delete(scan_id);
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
    try {
      await db.collection('appevents').insertOne({
        message: `NAS Scan started: ${roots.join(', ')}`,
        type: 'info',
        meta: { scan_id, roots },
        timestamp: new Date()
      });
    } catch (err) {
      console.error('[Storage] Failed to log scan start event:', err);
    }

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

/**
 * Batch insert files for a specific scan
 * Used by n8n N2.1 workflow to send file batches
 * POST /api/v1/storage/scan/:scan_id/batch
 */
const insertBatch = async (req, res, next) => {
  try {
    const { scan_id } = req.params;
    const { files, meta } = req.body;

    if (!scan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: scan_id'
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'files must be a non-empty array'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    
    // Verify scan exists
    const scanDoc = await db.collection('nas_scans').findOne({ _id: scan_id });
    if (!scanDoc) {
      return res.status(404).json({
        status: 'error',
        message: `Scan not found: ${scan_id}`
      });
    }

    // Process files: normalize and upsert
    const filesCollection = db.collection('nas_files');
    const now = new Date();
    
    const bulkOps = files.map(file => {
      // Normalize path (remove trailing slashes, etc.)
      const normalizedPath = file.path?.replace(/\/+$/, '').trim();
      
      // Extract filename and extension
      const pathParts = normalizedPath?.split('/') || [];
      const filename = pathParts.pop() || '';
      const dirname = pathParts.join('/') || '';
      const dotIdx = filename.lastIndexOf('.');
      const extension = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : '';

      return {
        updateOne: {
          filter: { path: normalizedPath },
          update: {
            $set: {
              path: normalizedPath,
              dirname,
              filename,
              extension,
              size: file.size || 0,
              modified: file.mtime ? new Date(file.mtime * 1000) : file.modified ? new Date(file.modified) : now,
              scan_id,
              updated_at: now
            },
            $setOnInsert: {
              created_at: now
            }
          },
          upsert: true
        }
      };
    });

    const result = await filesCollection.bulkWrite(bulkOps, { ordered: false });

    // Update scan stats
    await db.collection('nas_scans').updateOne(
      { _id: scan_id },
      {
        $inc: {
          'counts.files_processed': files.length,
          'counts.inserted': result.upsertedCount || 0,
          'counts.updated': result.modifiedCount || 0
        },
        $set: {
          last_batch_at: now
        }
      }
    );

    res.json({
      status: 'success',
      message: `Processed ${files.length} files`,
      data: {
        scan_id,
        batch: {
          received: files.length,
          inserted: result.upsertedCount || 0,
          updated: result.modifiedCount || 0
        },
        meta: meta || {}
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
      // Normalize 'completed' to 'complete' for consistency
      updateFields.status = status === 'completed' ? 'complete' : status;
    }
    
    // Set finished_at if status is complete/completed
    if (status === 'complete' || status === 'completed' || completedAt) {
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
      try {
        await db.collection('appevents').insertOne({
          message: `NAS Scan completed: ${scan_id}`,
          type: 'success',
          meta: { scan_id, stats },
          timestamp: new Date()
        });
      } catch (err) {
        console.error('[Storage] Failed to log scan complete event:', err);
      }
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
