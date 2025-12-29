const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/db');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Trigger a storage scan
 * POST /api/v1/storage/scan
 */
const scan = async (req, res, next) => {
  console.log('[Storage] Scan request received:', req.body);
  try {
    const { path: scanPath = '/mnt/datalake', recursive = true } = req.body;

    // Log the event using raw MongoDB to avoid Mongoose issues during scan
    try {
      const db = getDb();
      await db.collection('appevents').insertOne({
        type: 'STORAGE_SCAN_STARTED',
        message: `Manual scan triggered for ${scanPath}`,
        metadata: { scanPath, recursive },
        timestamp: new Date(),
        severity: 'info'
      });
    } catch (logError) {
      console.error('[Storage] Failed to log scan start:', logError.message);
      // Continue anyway
    }

    // In a real implementation, this would trigger a background worker
    // For now, we'll simulate it or run a simple find command if the path exists
    if (!fs.existsSync(scanPath)) {
      return res.status(400).json({
        status: 'error',
        message: `Path does not exist: ${scanPath}`
      });
    }

    // Respond immediately that scan has started
    res.status(202).json({
      status: 'success',
      message: 'Scan initiated',
      data: {
        path: scanPath,
        recursive
      }
    });

    // Run scan in background
    setTimeout(async () => {
      try {
        console.log(`[Storage] Starting background scan of ${scanPath}...`);
        // Simulate scan work
        const startTime = Date.now();
        
        // Trigger n8n webhook if configured
        if (process.env.N8N_WEBHOOK_URL) {
          // We'll implement the actual scan logic here later
          // For now, just log completion
        }

        const db = getDb();
        await db.collection('appevents').insertOne({
          type: 'STORAGE_SCAN_COMPLETED',
          message: `Scan of ${scanPath} completed`,
          metadata: { 
            scanPath, 
            durationMs: Date.now() - startTime 
          },
          timestamp: new Date(),
          severity: 'success'
        });

      } catch (err) {
        console.error('[Storage] Background scan error:', err);
      }
    }, 1000);

  } catch (error) {
    console.error('[Storage] Scan trigger error:', error);
    next(error);
  }
};

/**
 * Get storage stats
 * GET /api/v1/storage/stats
 */
const getStats = async (req, res, next) => {
  try {
    const rootPath = '/mnt/datalake';
    
    // Check if path exists
    if (!fs.existsSync(rootPath)) {
      return res.json({
        status: 'success',
        data: {
          path: rootPath,
          exists: false,
          message: 'Storage path not mounted'
        }
      });
    }

    // Get disk usage using df
    const { stdout } = await execPromise(`df -h ${rootPath} | tail -1`);
    const parts = stdout.split(/\s+/);
    
    res.json({
      status: 'success',
      data: {
        path: rootPath,
        exists: true,
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4]
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  scan,
  getStats
};
