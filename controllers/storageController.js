const { Scanner } = require('../src/jobs/scanner/scan');
const { ObjectId } = require('mongodb');
const fetch = require('node-fetch');

// Track running scans so they can be stopped
const runningScans = new Map();

// Helper to resolve n8n Webhook URL
function resolveN8nUrl() {
  return process.env.N8N_WEBHOOK_URL ||
         (process.env.N8N_WEBHOOK_BASE_URL && process.env.N8N_WEBHOOK_GENERIC ?
          `${process.env.N8N_WEBHOOK_BASE_URL}/${process.env.N8N_WEBHOOK_GENERIC}` : null);
}

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
    const { roots, extensions, exclude_extensions, batch_size, compute_hashes, hash_max_size } = req.body;
    
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
      excludeExt: exclude_extensions,
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
        exclude_extensions,
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
    const n8nUrl = resolveN8nUrl();

    if (status === 'completed' && n8nUrl) {
      fetch(n8nUrl, {
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

/**
 * Get n8n Integration Status
 * GET /api/v1/storage/n8n/status
 */
const getN8nStatus = async (req, res, next) => {
  try {
    const n8nUrl = resolveN8nUrl();

    let maskedUrl = null;
    if (n8nUrl) {
      try {
        const urlObj = new URL(n8nUrl);
        // Keep protocol, host, and first 5 chars of path, mask rest
        maskedUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(0, 5)}...`;
      } catch (e) {
        maskedUrl = 'Invalid URL Configured';
      }
    }

    const db = req.app.locals.dbs.mainDb;

    // Get recent events from integration_events or appevents that mention n8n
    // We'll search in integration_events (inbox) and appevents (outbox)

    const [inboxEvents, outboxEvents] = await Promise.all([
      db.collection('integration_events')
        .find({ src: 'n8n' })
        .sort({ at: -1 })
        .limit(5)
        .toArray(),
      db.collection('appevents')
        .find({
           $or: [
             { message: { $regex: 'n8n', $options: 'i' } },
             { type: 'n8n_test' }
           ]
        })
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray()
    ]);

    // Format events for display
    const events = [
      ...inboxEvents.map(e => ({
        id: e._id,
        type: 'Incoming',
        message: 'Received event from n8n',
        timestamp: e.at,
        details: e.body
      })),
      ...outboxEvents.map(e => ({
        id: e._id,
        type: 'Outgoing',
        message: e.message,
        timestamp: e.timestamp,
        details: e.meta
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    res.json({
      status: 'success',
      data: {
        configured: !!n8nUrl,
        url: maskedUrl,
        events
      }
    });
  } catch (error) {
    console.error('Failed to get n8n status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get n8n status',
      error: error.message
    });
  }
};

/**
 * Test n8n Webhook
 * POST /api/v1/storage/n8n/test
 */
const testN8nWebhook = async (req, res, next) => {
  try {
    const n8nUrl = resolveN8nUrl();

    if (!n8nUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'n8n Webhook URL is not configured'
      });
    }

    const payload = {
      event: 'test_connection',
      source: 'DataAPI Storage Tool',
      timestamp: new Date().toISOString(),
      user: req.user ? req.user.name : 'unknown'
    };

    console.log(`[Storage] Sending test webhook to ${n8nUrl}`);

    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const success = response.ok;
      const responseText = await response.text();

      // Log the attempt
      const db = req.app.locals.dbs.mainDb;
      await db.collection('appevents').insertOne({
        message: `n8n Webhook Test: ${success ? 'Success' : 'Failed'} (${response.status})`,
        type: 'n8n_test',
        meta: {
          url: n8nUrl,
          status: response.status,
          response: responseText.substring(0, 200)
        },
        timestamp: new Date()
      });

      if (success) {
        res.json({
          status: 'success',
          message: 'Webhook sent successfully',
          data: {
            status: response.status,
            response: responseText
          }
        });
      } else {
        res.status(502).json({
          status: 'error',
          message: `Webhook failed with status ${response.status}`,
          data: {
            response: responseText
          }
        });
      }
    } catch (fetchError) {
      console.error('[Storage] Webhook fetch error:', fetchError);

      // Log the failure
      const db = req.app.locals.dbs.mainDb;
      await db.collection('appevents').insertOne({
        message: `n8n Webhook Test Failed: ${fetchError.message}`,
        type: 'n8n_test',
        meta: { error: fetchError.message },
        timestamp: new Date()
      });

      res.status(502).json({
        status: 'error',
        message: 'Network error sending webhook',
        error: fetchError.message
      });
    }
  } catch (error) {
    console.error('Failed to test n8n webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to test webhook',
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
  cleanupStaleScans,
  getN8nStatus,
  testN8nWebhook
};
