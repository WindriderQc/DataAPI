const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { log } = require('../utils/logger');

// Analyze directory
router.post('/analyze', async (req, res) => {
  const { path: scanPath } = req.body;

  if (!scanPath) {
    return res.status(400).json({ error: 'path required' });
  }

  log(`Janitor: Starting analysis of ${scanPath}`, 'info');

  try {
    const result = await analyzeDirectory(scanPath);
    res.json(result);
  } catch (err) {
    log(`Janitor error: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Simple recursive analyzer
async function analyzeDirectory(dirPath) {
  const fileMap = new Map(); // hash -> files
  let totalFiles = 0;
  let totalSize = 0;
  let scannedFiles = 0;

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalFiles++;
          totalSize += stats.size;

          // Skip files larger than 100MB (too slow to hash)
          if (stats.size > 100 * 1024 * 1024) {
            continue;
          }

          // Hash file
          try {
            const content = await fs.readFile(fullPath);
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            if (!fileMap.has(hash)) fileMap.set(hash, []);
            fileMap.get(hash).push({
              path: fullPath,
              size: stats.size,
              mtime: stats.mtime
            });

            scannedFiles++;
          } catch (readErr) {
            // Skip files we can't read
            log(`Cannot read ${fullPath}: ${readErr.message}`, 'warn');
          }
        }
      }
    } catch (scanErr) {
      // Skip directories we can't access
      log(`Cannot scan ${dir}: ${scanErr.message}`, 'warn');
    }
  }

  await scan(dirPath);

  // Find duplicates
  const duplicates = [];
  for (const [hash, files] of fileMap.entries()) {
    if (files.length > 1) {
      duplicates.push({
        hash,
        count: files.length,
        files: files.map(f => f.path),
        size: files[0].size,
        wasted: files[0].size * (files.length - 1)
      });
    }
  }

  const totalWasted = duplicates.reduce((sum, d) => sum + d.wasted, 0);

  log(`Janitor: Analysis complete - ${duplicates.length} duplicate groups found`, 'info');

  return {
    path: dirPath,
    total_files: totalFiles,
    scanned_files: scannedFiles,
    total_size: totalSize,
    duplicates_count: duplicates.length,
    wasted_space: totalWasted,
    wasted_space_mb: Math.round(totalWasted / 1024 / 1024),
    duplicate_groups: duplicates.slice(0, 50)  // Return max 50 groups
  };
}

module.exports = router;
