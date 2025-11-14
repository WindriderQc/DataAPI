const express = require('express');
const n8nAuth = require('../middleware/n8nAuth');
const { ObjectId } = require('mongodb');
const { triggerWebhook, triggers } = require('../utils/n8nWebhook');

const router = express.Router();

/**
 * n8n-specific routes
 * These routes bypass session-based authentication and use API key authentication instead.
 * All routes in this file are protected by the n8nAuth middleware.
 */

/**
 * Health check endpoint for n8n
 * GET /api/v1/n8n/health
 */
router.get('/n8n/health', n8nAuth, (req, res) => {
  res.json({ 
    status: 'success',
    message: 'n8n API is healthy',
    timestamp: new Date().toISOString(),
    source: 'n8n'
  });
});

/**
 * Get NAS scan status
 * GET /api/v1/n8n/nas/scan/:scanId
 */
router.get('/n8n/nas/scan/:scanId', n8nAuth, async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const db = req.app.locals.dbs.mainDb;
    
    const scan = await db.collection('nas_scans').findOne({ 
      _id: scanId 
    });

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
    next(error);
  }
});

/**
 * List recent NAS scans
 * GET /api/v1/n8n/nas/scans
 */
router.get('/n8n/nas/scans', n8nAuth, async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const limit = parseInt(req.query.limit) || 10;

    const scans = await db.collection('nas_scans')
      .find({})
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();

    res.json({
      status: 'success',
      results: scans.length,
      data: scans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Insert/update NAS files (bulk upsert)
 * POST /api/v1/n8n/nas/files
 * 
 * Body: {
 *   files: Array of file objects with path, size, modified, etc.
 *   scanId: Optional scan ID to associate files with
 * }
 */
router.post('/n8n/nas/files', n8nAuth, async (req, res, next) => {
  try {
    const { files, scanId } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'files must be a non-empty array'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    const collection = db.collection('nas_files');

    // Prepare bulk operations
    const bulkOps = files.map(file => ({
      updateOne: {
        filter: { path: file.path },
        update: { 
          $set: {
            ...file,
            scanId: scanId || file.scanId,
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(bulkOps);

    res.json({
      status: 'success',
      message: 'Files processed',
      data: {
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        matched: result.matchedCount,
        total: files.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a NAS scan record
 * POST /api/v1/n8n/nas/scan
 * 
 * Body: {
 *   roots: Array of root paths,
 *   extensions: Array of file extensions,
 *   metadata: Optional additional metadata
 * }
 */
router.post('/n8n/nas/scan', n8nAuth, async (req, res, next) => {
  try {
    const { roots, extensions, metadata } = req.body;

    if (!roots || !Array.isArray(roots) || roots.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'roots must be a non-empty array'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    const scanId = new ObjectId().toHexString();

    const scanDoc = {
      _id: scanId,
      roots,
      extensions: extensions || [],
      status: 'pending',
      startedAt: new Date(),
      completedAt: null,
      filesFound: 0,
      filesProcessed: 0,
      errors: [],
      metadata: metadata || {},
      source: 'n8n'
    };

    await db.collection('nas_scans').insertOne(scanDoc);

    res.status(201).json({
      status: 'success',
      message: 'Scan record created',
      data: { scanId, scan: scanDoc }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update NAS scan status
 * PATCH /api/v1/n8n/nas/scan/:scanId
 * 
 * Body: {
 *   status: 'completed' | 'failed' | 'running',
 *   filesFound: number,
 *   filesProcessed: number,
 *   errors: Array,
 *   metadata: Object
 * }
 */
router.patch('/n8n/nas/scan/:scanId', n8nAuth, async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const updates = req.body;

    const db = req.app.locals.dbs.mainDb;

    // Build update document
    const updateDoc = {
      $set: {
        ...updates,
        lastUpdated: new Date()
      }
    };

    // If status is being set to completed or failed, set completedAt
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateDoc.$set.completedAt = new Date();
    }

    const result = await db.collection('nas_scans').updateOne(
      { _id: scanId },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Scan not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Scan updated',
      data: { scanId, modified: result.modifiedCount > 0 }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get database statistics (useful for monitoring)
 * GET /api/v1/n8n/stats
 */
router.get('/n8n/stats', n8nAuth, async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;

    const [fileCount, scanCount, directoryCount] = await Promise.all([
      db.collection('nas_files').countDocuments(),
      db.collection('nas_scans').countDocuments(),
      db.collection('nas_directories').countDocuments()
    ]);

    // Get the most recent scan
    const recentScan = await db.collection('nas_scans')
      .find({})
      .sort({ startedAt: -1 })
      .limit(1)
      .toArray();

    res.json({
      status: 'success',
      data: {
        collections: {
          nas_files: fileCount,
          nas_scans: scanCount,
          nas_directories: directoryCount
        },
        recentScan: recentScan[0] || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Query NAS files with filters
 * GET /api/v1/n8n/nas/files
 * 
 * Query params:
 * - extension: Filter by file extension
 * - minSize: Minimum file size in bytes
 * - maxSize: Maximum file size in bytes
 * - scanId: Filter by scan ID
 * - limit: Number of results (default: 100, max: 1000)
 * - skip: Number of results to skip for pagination
 */
router.get('/n8n/nas/files', n8nAuth, async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const { extension, minSize, maxSize, scanId, limit = 100, skip = 0 } = req.query;

    // Build query
    const query = {};
    
    if (extension) {
      query.extension = extension;
    }
    
    if (minSize || maxSize) {
      query.size = {};
      if (minSize) query.size.$gte = parseInt(minSize);
      if (maxSize) query.size.$lte = parseInt(maxSize);
    }
    
    if (scanId) {
      query.scanId = scanId;
    }

    const files = await db.collection('nas_files')
      .find(query)
      .sort({ modified: -1 })
      .skip(parseInt(skip))
      .limit(Math.min(parseInt(limit), 1000))
      .toArray();

    const total = await db.collection('nas_files').countDocuments(query);

    res.json({
      status: 'success',
      results: files.length,
      total,
      data: files
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger n8n webhook manually
 * POST /api/v1/n8n/trigger/:webhookId
 * 
 * Body: Any JSON payload to send to n8n
 */
router.post('/n8n/trigger/:webhookId', n8nAuth, async (req, res, next) => {
  try {
    const { webhookId } = req.params;
    const payload = req.body;

    const result = await triggerWebhook(webhookId, payload);

    if (result.success) {
      return res.json({
        status: 'success',
        message: `Triggered n8n webhook: ${webhookId}`,
        data: result.data
      });
    } else {
      return res.status(502).json({
        status: 'error',
        message: `Failed to trigger n8n webhook: ${webhookId}`,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger predefined event webhooks
 * POST /api/v1/n8n/event/:eventType
 * 
 * Event types: scan_complete, files_exported, storage_alert, custom
 */
router.post('/n8n/event/:eventType', n8nAuth, async (req, res, next) => {
  try {
    const { eventType } = req.params;
    const eventData = req.body;

    let result;
    switch (eventType) {
      case 'scan_complete':
        result = await triggers.scanComplete(eventData);
        break;
      case 'files_exported':
        result = await triggers.filesExported(eventData);
        break;
      case 'storage_alert':
        result = await triggers.storageAlert(eventData);
        break;
      case 'custom':
        result = await triggers.event(eventData.event, eventData.data);
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: `Unknown event type: ${eventType}. Valid types: scan_complete, files_exported, storage_alert, custom`
        });
    }

    if (result.success) {
      return res.json({
        status: 'success',
        message: `Triggered ${eventType} webhook`,
        data: result.data
      });
    } else {
      return res.status(502).json({
        status: 'error',
        message: `Failed to trigger ${eventType} webhook`,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
