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
   * Find duplicate files (by size and filename)
   */
  static async findDuplicates(req, res, next) {
    try {
      const db = req.app.locals.dbs.mainDb;
      const files = db.collection('nas_files');

      const duplicates = await files.aggregate([
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
        { $limit: 100 }
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
}

module.exports = FileBrowserController;
