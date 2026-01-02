const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsNative = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log } = require('../utils/logger');

// Default cleanup policies
const DEFAULT_POLICIES = {
  delete_duplicates: {
    id: 'delete_duplicates',
    name: 'Delete Duplicate Files',
    description: 'Keep the oldest copy, delete newer duplicates',
    enabled: true,
    safe_mode: true
  },
  remove_temp_files: {
    id: 'remove_temp_files',
    name: 'Remove Temporary Files',
    description: 'Delete files in temp directories older than 7 days',
    enabled: true,
    safe_mode: true,
    age_days: 7
  },
  remove_large_files: {
    id: 'remove_large_files',
    name: 'Flag Large Files',
    description: 'Identify files larger than 1GB for manual review',
    enabled: false,
    safe_mode: true,
    size_threshold_gb: 1
  }
};

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
  const MAX_FILES = 2000; // Safety limit

  async function scan(dir) {
    if (totalFiles >= MAX_FILES) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (totalFiles >= MAX_FILES) break;
        
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

          // Hash file using stream
          try {
            const hash = await new Promise((resolve, reject) => {
                const hashSum = crypto.createHash('sha256');
                const stream = fsNative.createReadStream(fullPath);
                stream.on('error', reject);
                stream.on('data', chunk => hashSum.update(chunk));
                stream.on('end', () => resolve(hashSum.digest('hex')));
            });

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
      log(`Cannot scan dir ${dir}: ${scanErr.message}`, 'warn');
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
    duplicate_groups: duplicates.slice(0, 50),  // Return max 50 groups
    fileMap  // Return for suggest endpoint
  };
}

// Generate cleanup suggestions based on policies
router.post('/suggest', async (req, res) => {
  const { path: scanPath, policies } = req.body;

  if (!scanPath) {
    return res.status(400).json({ error: 'path required' });
  }

  log(`Janitor: Generating suggestions for ${scanPath}`, 'info');

  try {
    const analysis = await analyzeDirectory(scanPath);
    const activePolicies = policies || Object.keys(DEFAULT_POLICIES).filter(k => DEFAULT_POLICIES[k].enabled);
    const suggestions = [];

    // Policy: Delete duplicates
    if (activePolicies.includes('delete_duplicates')) {
      for (const group of analysis.duplicate_groups) {
        // Keep oldest, suggest deleting others
        const files = group.files.map((filePath, idx) => {
          const fileFromMap = Array.from(analysis.fileMap.get(group.hash))[idx];
          return { path: filePath, mtime: fileFromMap.mtime };
        }).sort((a, b) => new Date(a.mtime) - new Date(b.mtime));

        const toDelete = files.slice(1);  // All but the oldest

        if (toDelete.length > 0) {
          suggestions.push({
            policy: 'delete_duplicates',
            action: 'delete',
            files: toDelete.map(f => f.path),
            reason: `Duplicate of ${files[0].path}`,
            space_saved: group.wasted
          });
        }
      }
    }

    // Policy: Remove temp files
    if (activePolicies.includes('remove_temp_files')) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (DEFAULT_POLICIES.remove_temp_files.age_days || 7));

      // Simplified: check if path contains 'temp' or 'tmp'
      for (const [hash, files] of analysis.fileMap.entries()) {
        for (const file of files) {
          if ((file.path.includes('/temp/') || file.path.includes('/tmp/')) &&
              new Date(file.mtime) < cutoffDate) {
            suggestions.push({
              policy: 'remove_temp_files',
              action: 'delete',
              files: [file.path],
              reason: `Temp file older than ${DEFAULT_POLICIES.remove_temp_files.age_days} days`,
              space_saved: file.size
            });
          }
        }
      }
    }

    const totalSpaceSaved = suggestions.reduce((sum, s) => sum + (s.space_saved || 0), 0);

    log(`Janitor: Generated ${suggestions.length} suggestions`, 'info');

    res.json({
      path: scanPath,
      suggestions_count: suggestions.length,
      total_space_saved: totalSpaceSaved,
      total_space_saved_mb: Math.round(totalSpaceSaved / 1024 / 1024),
      suggestions: suggestions.slice(0, 100),  // Limit to 100
      policies_applied: activePolicies
    });
  } catch (err) {
    log(`Janitor suggest error: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Execute cleanup operations (with safety checks)
router.post('/execute', async (req, res) => {
  const { files, dry_run } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'files array required' });
  }

  const isDryRun = dry_run !== false;  // Default to dry run for safety

  log(`Janitor: ${isDryRun ? 'DRY RUN' : 'EXECUTING'} cleanup of ${files.length} files`, 'info');

  const results = {
    dry_run: isDryRun,
    total_files: files.length,
    deleted: [],
    failed: [],
    space_freed: 0
  };

  for (const filePath of files) {
    try {
      // Safety checks
      if (!filePath || typeof filePath !== 'string') {
        results.failed.push({ file: filePath, reason: 'Invalid file path' });
        continue;
      }

      // Prevent deleting system files or root directories
      const blocklist = ['/', '/home', '/usr', '/bin', '/etc', '/var', '/sys', '/proc'];
      if (blocklist.includes(filePath) || !path.isAbsolute(filePath)) {
        results.failed.push({ file: filePath, reason: 'Blocked by safety policy' });
        continue;
      }

      // Check if file exists
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats) {
        results.failed.push({ file: filePath, reason: 'File not found' });
        continue;
      }

      if (!isDryRun) {
        await fs.unlink(filePath);
        log(`Janitor: Deleted ${filePath}`, 'info');
      }

      results.deleted.push(filePath);
      results.space_freed += stats.size;
    } catch (err) {
      results.failed.push({ file: filePath, reason: err.message });
      log(`Janitor: Failed to delete ${filePath}: ${err.message}`, 'warn');
    }
  }

  log(`Janitor: Cleanup ${isDryRun ? 'simulation' : 'execution'} complete`, 'info');

  res.json({
    ...results,
    space_freed_mb: Math.round(results.space_freed / 1024 / 1024),
    warning: isDryRun ? 'This was a dry run. No files were actually deleted.' : 'Files have been permanently deleted.'
  });
});

// List available policies
router.get('/policies', (req, res) => {
  res.json({
    policies: Object.values(DEFAULT_POLICIES)
  });
});

module.exports = router;
