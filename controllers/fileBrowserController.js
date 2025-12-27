const { formatFileSize } = require('../utils/file-operations');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class FileBrowserController {
  /**
   * Browse files with filtering and pagination
   */
  static async browseFiles(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');

      // Extract query parameters
      const {
        search = '',
        ext = '',
        dirname = '',
        scan_id = '',
        hasHash = '',
        minSize = 0,
        maxSize = Infinity,
        sortBy = 'mtime',
        sortOrder = 'desc',
        page = 1,
        limit = 100
      } = req.query;

      // Build filter
      const filter = {};

      if (search) {
        filter.filename = { $regex: search, $options: 'i' };
      }

      if (ext) {
        filter.ext = ext.toLowerCase();
      }

      if (dirname) {
        filter.dirname = { $regex: `^${dirname}`, $options: 'i' };
      }

      if (scan_id) {
        filter.scan_id = scan_id;
      }

      if (hasHash === 'true') {
        filter.sha256 = { $exists: true, $ne: null };
      } else if (hasHash === 'false') {
        filter.$or = [
          { sha256: { $exists: false } },
          { sha256: null }
        ];
      }

      if (minSize > 0 || maxSize < Infinity) {
        filter.size = {};
        if (minSize > 0) filter.size.$gte = parseInt(minSize);
        if (maxSize < Infinity) filter.size.$lte = parseInt(maxSize);
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const [totalCount, results] = await Promise.all([
        files.countDocuments(filter),
        files.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray()
      ]);

      // Format results
      const formattedResults = results.map(file => ({
        ...file,
        path: file.dirname + file.filename,
        sizeFormatted: formatFileSize(file.size),
        mtimeFormatted: new Date(file.mtime * 1000).toISOString()
      }));

      res.json({
        status: 'success',
        data: {
          files: formattedResults,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get directory tree structure
   */
  static async getDirectoryTree(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const directories = db.collection('nas_directories');

      const { root = '/' } = req.query;

      // Get all directories under root
      const dirs = await directories.find({
        path: { $regex: `^${root}` }
      }).toArray();

      // Build tree structure
      const tree = FileBrowserController._buildTree(dirs, root);

      res.json({
        status: 'success',
        data: { tree }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get file statistics
   */
  static async getStats(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');

      const stats = await files.aggregate([
        {
          $facet: {
            byExtension: [
              { $group: { _id: '$ext', count: { $sum: 1 }, size: { $sum: '$size' } } },
              { $sort: { size: -1 } },
              { $limit: 10 }
            ],
            bySize: [
              {
                $bucket: {
                  groupBy: '$size',
                  boundaries: [0, 1024, 10240, 102400, 1048576, 10485760, 104857600, Infinity],
                  default: 'other',
                  output: { count: { $sum: 1 }, totalSize: { $sum: '$size' } }
                }
              }
            ],
            total: [
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  totalSize: { $sum: '$size' },
                  avgSize: { $avg: '$size' }
                }
              }
            ]
          }
        }
      ], { allowDiskUse: true }).toArray();

      const result = stats[0];

      // Format size categories
      const sizeCategories = {
        '<1KB': 0, '1KB-10KB': 0, '10KB-100KB': 0, '100KB-1MB': 0,
        '1MB-10MB': 0, '10MB-100MB': 0, '>100MB': 0
      };

      result.bySize.forEach(bucket => {
        const key = FileBrowserController._getSizeCategoryLabel(bucket._id);
        sizeCategories[key] = bucket.count;
      });

      res.json({
        status: 'success',
        data: {
          total: result.total[0] || { count: 0, totalSize: 0, avgSize: 0 },
          byExtension: result.byExtension.map(ext => ({
            extension: ext._id || 'no extension',
            count: ext.count,
            size: ext.size,
            sizeFormatted: formatFileSize(ext.size)
          })),
          sizeCategories
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find duplicate files (by SHA256 hash, falling back to size+filename)
   * Query params:
   *   - method: 'hash' (default if hashes exist) or 'fuzzy' (size+name)
   *   - limit: max results (default 100)
   */
  static async findDuplicates(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');
      
      const limit = parseInt(req.query.limit) || 100;
      const method = req.query.method || 'auto';
      
      // Check if we have any hashed files
      let useHashMethod = false;
      if (method === 'hash' || method === 'auto') {
        const hashCount = await files.countDocuments({ sha256: { $exists: true, $ne: null } });
        useHashMethod = hashCount > 0 && method !== 'fuzzy';
      }
      
      let duplicates;
      
      if (useHashMethod) {
        // Hash-based deduplication (accurate - identical content)
        duplicates = await files.aggregate([
          { $match: { sha256: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$sha256',
              count: { $sum: 1 },
              files: { $push: { path: '$path', dirname: '$dirname', filename: '$filename', mtime: '$mtime' } },
              totalSize: { $first: '$size' }
            }
          },
          { $match: { count: { $gt: 1 } } },
          { $sort: { totalSize: -1 } },
          { $limit: limit }
        ], { allowDiskUse: true }).toArray();
        
        const formatted = duplicates.map(dup => ({
          sha256: dup._id,
          size: dup.totalSize,
          sizeFormatted: formatFileSize(dup.totalSize),
          count: dup.count,
          wastedSpace: dup.totalSize * (dup.count - 1),
          wastedSpaceFormatted: formatFileSize(dup.totalSize * (dup.count - 1)),
          locations: dup.files
        }));
        
        const totalWasted = formatted.reduce((sum, dup) => sum + dup.wastedSpace, 0);
        
        return res.json({
          status: 'success',
          data: {
            method: 'sha256',
            duplicates: formatted,
            summary: {
              totalDuplicateGroups: formatted.length,
              totalWastedSpace: totalWasted,
              totalWastedSpaceFormatted: formatFileSize(totalWasted)
            }
          }
        });
      }
      
      // Fuzzy deduplication (fallback - same name and size)
      duplicates = await files.aggregate([
        {
          $group: {
            _id: { filename: '$filename', size: '$size' },
            count: { $sum: 1 },
            files: { $push: { dirname: '$dirname', mtime: '$mtime' } },
            totalSize: { $first: '$size' }
          }
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { totalSize: -1 } },
        { $limit: limit }
      ], { allowDiskUse: true }).toArray();

      const formatted = duplicates.map(dup => ({
        filename: dup._id.filename,
        size: dup._id.size,
        sizeFormatted: formatFileSize(dup._id.size),
        count: dup.count,
        wastedSpace: dup._id.size * (dup.count - 1),
        wastedSpaceFormatted: formatFileSize(dup._id.size * (dup.count - 1)),
        locations: dup.files
      }));

      const totalWasted = formatted.reduce((sum, dup) => sum + dup.wastedSpace, 0);

      res.json({
        status: 'success',
        data: {
          method: 'fuzzy',
          note: 'Run a scan with compute_hashes=true for accurate hash-based deduplication',
          duplicates: formatted,
          summary: {
            totalDuplicateGroups: formatted.length,
            totalWastedSpace: totalWasted,
            totalWastedSpaceFormatted: formatFileSize(totalWasted)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cleanup recommendations
   */
  static async getCleanupRecommendations(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');

      const [largeFiles, oldFiles, duplicates] = await Promise.all([
        // Large files (>100MB)
        files.find({ size: { $gt: 104857600 } })
          .sort({ size: -1 })
          .limit(20)
          .toArray(),

        // Old files (>2 years)
        files.find({ mtime: { $lt: Math.floor(Date.now() / 1000) - (730 * 86400) } })
          .sort({ mtime: 1 })
          .limit(20)
          .toArray(),

        // Duplicate count
        files.aggregate([
          { $group: { _id: { filename: '$filename', size: '$size' }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $count: 'total' }
        ], { allowDiskUse: true }).toArray()
      ]);

      res.json({
        status: 'success',
        data: {
          recommendations: [
            {
              type: 'large_files',
              priority: 'high',
              message: `Found ${largeFiles.length} files over 100MB`,
              potentialSavings: largeFiles.reduce((sum, f) => sum + f.size, 0),
              files: largeFiles.map(f => ({
                path: f.dirname + f.filename,
                size: f.size,
                sizeFormatted: formatFileSize(f.size)
              }))
            },
            {
              type: 'old_files',
              priority: 'medium',
              message: `Found ${oldFiles.length} files older than 2 years`,
              files: oldFiles.map(f => ({
                path: f.dirname + f.filename,
                age: Math.floor((Date.now() / 1000 - f.mtime) / 86400) + ' days',
                size: formatFileSize(f.size)
              }))
            },
            {
              type: 'duplicates',
              priority: 'high',
              message: `Found ${duplicates[0]?.total || 0} groups of duplicate files`,
              action: 'Run duplicate detector for details'
            }
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  static _buildTree(dirs, root) {
    // Simple tree building - can be enhanced
    return dirs.map(dir => ({
      path: dir.path,
      fileCount: dir.file_count,
      totalSize: dir.total_size,
      totalSizeFormatted: formatFileSize(dir.total_size),
      largestFile: dir.largest_file
    }));
  }

  static _getSizeCategoryLabel(boundary) {
    const labels = ['<1KB', '1KB-10KB', '10KB-100KB', '100KB-1MB', '1MB-10MB', '10MB-100MB', '>100MB'];
    const boundaries = [0, 1024, 10240, 102400, 1048576, 10485760, 104857600];
    const index = boundaries.indexOf(boundary);
    return labels[index] || 'other';
  }

  // ==========================================
  // Datalake Janitor Methods
  // ==========================================

  /**
   * Suggest files for deletion based on duplicate analysis
   * Uses a strategy to keep the "best" copy (oldest mtime = original)
   * Body params:
   *   - sha256: specific hash to analyze (optional)
   *   - strategy: 'keep_oldest' (default) or 'keep_newest'
   *   - minSize: minimum file size to consider (default 0)
   */
  static async suggestDeletions(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');
      
      const { sha256, strategy = 'keep_oldest', minSize = 0 } = req.body;
      
      let matchStage = { sha256: { $exists: true, $ne: null } };
      if (sha256) matchStage.sha256 = sha256;
      if (minSize > 0) matchStage.size = { $gte: minSize };
      
      const duplicates = await files.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$sha256',
            count: { $sum: 1 },
            files: { 
              $push: { 
                _id: '$_id',
                path: '$path', 
                dirname: '$dirname', 
                filename: '$filename', 
                mtime: '$mtime',
                size: '$size'
              } 
            },
            totalSize: { $first: '$size' }
          }
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { totalSize: -1 } },
        { $limit: 50 }
      ], { allowDiskUse: true }).toArray();
      
      const suggestions = duplicates.map(dup => {
        // Sort files by mtime to find oldest/newest
        const sorted = [...dup.files].sort((a, b) => a.mtime - b.mtime);
        const keep = strategy === 'keep_newest' ? sorted[sorted.length - 1] : sorted[0];
        const toDelete = sorted.filter(f => f._id.toString() !== keep._id.toString());
        
        return {
          sha256: dup._id,
          size: dup.totalSize,
          sizeFormatted: formatFileSize(dup.totalSize),
          keep: {
            path: keep.path,
            mtime: new Date(keep.mtime * 1000).toISOString(),
            reason: strategy === 'keep_newest' ? 'Newest copy' : 'Oldest copy (likely original)'
          },
          suggestDelete: toDelete.map(f => ({
            fileId: f._id,
            path: f.path,
            mtime: new Date(f.mtime * 1000).toISOString()
          })),
          potentialSavings: dup.totalSize * toDelete.length,
          potentialSavingsFormatted: formatFileSize(dup.totalSize * toDelete.length)
        };
      });
      
      const totalSavings = suggestions.reduce((sum, s) => sum + s.potentialSavings, 0);
      
      res.json({
        status: 'success',
        data: {
          strategy,
          suggestions,
          summary: {
            duplicateGroups: suggestions.length,
            totalFilesToDelete: suggestions.reduce((sum, s) => sum + s.suggestDelete.length, 0),
            totalPotentialSavings: totalSavings,
            totalPotentialSavingsFormatted: formatFileSize(totalSavings)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark files for deletion (soft delete - just flags them)
   * Body: { files: [{ fileId, path, reason }] }
   */
  static async markForDeletion(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const deletions = db.collection('nas_pending_deletions');
      const { files } = req.body;
      
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'files array is required'
        });
      }
      
      const docs = files.map(f => ({
        file_id: f.fileId,
        path: f.path,
        reason: f.reason || 'duplicate',
        marked_at: new Date(),
        marked_by: res.locals.user?.name || 'api',
        status: 'pending'
      }));
      
      const result = await deletions.insertMany(docs);
      
      res.json({
        status: 'success',
        message: `${result.insertedCount} files marked for deletion`,
        data: {
          insertedCount: result.insertedCount,
          ids: Object.values(result.insertedIds)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending deletions
   */
  static async getPendingDeletions(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const deletions = db.collection('nas_pending_deletions');
      
      const pending = await deletions.find({ status: 'pending' })
        .sort({ marked_at: -1 })
        .limit(100)
        .toArray();
      
      res.json({
        status: 'success',
        data: {
          count: pending.length,
          pending
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm and execute deletion (requires explicit confirmation)
   * This is a DESTRUCTIVE operation - actually deletes the file from disk
   * Params: id (pending deletion record ID)
   * Body: { confirm: true } - must be explicitly set
   */
  static async confirmDeletion(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const deletions = db.collection('nas_pending_deletions');
      const files = db.collection('nas_files');
      const { ObjectId } = require('mongodb');
      const fs = require('fs/promises');
      
      const { id } = req.params;
      const { confirm } = req.body;
      
      if (confirm !== true) {
        return res.status(400).json({
          status: 'error',
          message: 'Explicit confirmation required: { "confirm": true }'
        });
      }
      
      const record = await deletions.findOne({ _id: new ObjectId(id), status: 'pending' });
      
      if (!record) {
        return res.status(404).json({
          status: 'error',
          message: 'Pending deletion not found or already processed'
        });
      }
      
      try {
        // Actually delete the file from disk
        await fs.unlink(record.path);
        
        // Update the pending deletion record
        await deletions.updateOne(
          { _id: record._id },
          { 
            $set: { 
              status: 'completed',
              deleted_at: new Date(),
              deleted_by: res.locals.user?.name || 'api'
            }
          }
        );
        
        // Remove from nas_files collection
        await files.deleteOne({ path: record.path });
        
        res.json({
          status: 'success',
          message: 'File deleted successfully',
          data: {
            path: record.path,
            deleted_at: new Date().toISOString()
          }
        });
      } catch (deleteErr) {
        // Mark as failed if file deletion fails
        await deletions.updateOne(
          { _id: record._id },
          { 
            $set: { 
              status: 'failed',
              error: deleteErr.message
            }
          }
        );
        
        return res.status(500).json({
          status: 'error',
          message: `Failed to delete file: ${deleteErr.message}`,
          data: { path: record.path }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update file metadata (e.g., hash)
   * PATCH /api/v1/files/:id
   */
  static async updateFile(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');

      if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing file ID' });
      }

      // Remove protected fields
      delete updates._id;
      delete updates.path;
      delete updates.created_at;

      const result = await files.findOneAndUpdate(
        { _id: id },
        { 
          $set: { 
            ...updates,
            updated_at: new Date()
          } 
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        // Try by path if ID not found (sometimes n8n uses path as ID)
        const resultByPath = await files.findOneAndUpdate(
          { path: id },
          { 
            $set: { 
              ...updates,
              updated_at: new Date()
            } 
          },
          { returnDocument: 'after' }
        );

        if (!resultByPath.value) {
          return res.status(404).json({ status: 'error', message: `File not found: ${id}` });
        }

        return res.json({
          status: 'success',
          message: 'File updated successfully',
          data: resultByPath.value
        });
      }

      res.json({
        status: 'success',
        message: 'File updated successfully',
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FileBrowserController;
