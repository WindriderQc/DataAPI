/**
 * Shared utility functions for file operations
 * Consolidates common file utilities used across controllers
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

/**
 * Formats file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validates a filename for security (prevents path traversal)
 * @param {string} filename - The filename to validate
 * @returns {boolean} - True if filename is safe
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  
  // Check for control characters
  if (/[\x00-\x1f\x80-\x9f]/.test(filename)) {
    return false;
  }
  
  return true;
}

/**
 * Ensures a directory exists, creating it if needed (async)
 * @param {string} dirPath - The directory path
 * @returns {Promise<boolean>} - True if successful
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Checks if a file or directory exists (sync)
 * @param {string} filePath - The path to check
 * @returns {boolean} - True if exists
 */
function exists(filePath) {
  try {
    return fsSync.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Safely writes a file with directory creation
 * @param {string} filePath - The file path
 * @param {string} content - The content to write
 * @returns {Promise<boolean>} - True if successful
 */
async function writeFileSafe(filePath, content) {
  try {
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    await ensureDir(dirPath);
    
    // Write the file
    await fs.writeFile(filePath, content);
    return true;
  } catch (error) {
    console.error(`Failed to write file ${filePath}:`, error);
    return false;
  }
}

/**
 * Safely deletes a file
 * @param {string} filePath - The file path
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteFileSafe(filePath) {
  try {
    if (!fsSync.existsSync(filePath)) {
      return true; // File doesn't exist, consider success
    }
    
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error);
    return false;
  }
}

/**
 * Lists files in a directory with metadata
 * @param {string} dirPath - The directory path
 * @param {object} options - Filtering options
 * @returns {Promise<Array>} - Array of file objects with metadata
 */
async function listFilesWithMeta(dirPath, options = {}) {
  try {
    if (!fsSync.existsSync(dirPath)) {
      return [];
    }
    
    const files = await fs.readdir(dirPath);
    const fileStats = await Promise.all(
      files.map(async filename => {
        const filePath = path.join(dirPath, filename);
        const stats = await fs.stat(filePath);
        
        return {
          filename,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile()
        };
      })
    );
    
    // Apply filters if provided
    let filtered = fileStats;
    
    if (options.filesOnly) {
      filtered = filtered.filter(f => f.isFile);
    }
    
    if (options.dirsOnly) {
      filtered = filtered.filter(f => f.isDirectory);
    }
    
    // Sort if requested
    if (options.sortBy) {
      const field = options.sortBy;
      const order = options.sortOrder === 'desc' ? -1 : 1;
      
      filtered.sort((a, b) => {
        if (a[field] < b[field]) return -1 * order;
        if (a[field] > b[field]) return 1 * order;
        return 0;
      });
    }
    
    return filtered;
  } catch (error) {
    console.error(`Failed to list files in ${dirPath}:`, error);
    return [];
  }
}

module.exports = {
  formatFileSize,
  validateFilename,
  ensureDir,
  exists,
  writeFileSafe,
  deleteFileSafe,
  listFilesWithMeta
};