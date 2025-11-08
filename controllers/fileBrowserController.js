const { ObjectId } = require('mongodb');
const path = require('path');
const { formatFileSize } = require('../utils/file-operations');

const browse = async (req, res, next) => {
  try {
    const { 
      path: browsePath = '/', 
      search = '', 
      ext = '', 
      limit = 50, 
      skip = 0, 
      sortBy = 'filename',
      sortDir = 'asc' 
    } = req.query;

    const db = req.app.locals.dbs.mainDb;
    const collection = db.collection('nas_files');

    // Build query
    let query = {};
    
    // Path filtering
    if (browsePath && browsePath !== '/') {
      query.dirname = new RegExp(`^${browsePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    }

    // Search filtering
    if (search) {
      query.$or = [
        { filename: new RegExp(search, 'i') },
        { path: new RegExp(search, 'i') }
      ];
    }

    // Extension filtering
    if (ext) {
      query.ext = ext.toLowerCase();
    }

    // Get total count for pagination
    const total = await collection.countDocuments(query);

    // Build sort
    const sort = {};
    sort[sortBy] = sortDir === 'desc' ? -1 : 1;

    // Get files
    const files = await collection
      .find(query)
      .sort(sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    // Get directory structure for current path
    const directories = await collection.distinct('dirname', {
      dirname: new RegExp(`^${browsePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    });

    // Get available extensions
    const extensions = await collection.distinct('ext');

    res.json({
      status: 'success',
      data: {
        files: files.map(file => ({
          ...file,
          sizeFormatted: formatFileSize(file.size),
          mtimeFormatted: new Date(file.mtime * 1000).toLocaleString()
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > (parseInt(skip) + parseInt(limit))
        },
        directories: directories.slice(0, 100), // Limit for performance
        extensions: extensions.sort(),
        currentPath: browsePath
      }
    });
  } catch (error) {
    console.error('File browser error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to browse files',
      error: error.message
    });
  }
};

const stats = async (req, res, next) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const collection = db.collection('nas_files');

    // Get basic stats
    const totalFiles = await collection.countDocuments();
    const totalSize = await collection.aggregate([
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]).toArray();

    // Get stats by extension
    const extensionStats = await collection.aggregate([
      { $group: { 
          _id: '$ext', 
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();

    // Get largest files
    const largestFiles = await collection
      .find({})
      .sort({ size: -1 })
      .limit(10)
      .toArray();

    res.json({
      status: 'success',
      data: {
        totalFiles,
        totalSize: totalSize[0]?.totalSize || 0,
        totalSizeFormatted: formatFileSize(totalSize[0]?.totalSize || 0),
        extensionStats: extensionStats.map(stat => ({
          ...stat,
          totalSizeFormatted: formatFileSize(stat.totalSize)
        })),
        largestFiles: largestFiles.map(file => ({
          ...file,
          sizeFormatted: formatFileSize(file.size)
        }))
      }
    });
  } catch (error) {
    console.error('File stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get file statistics',
      error: error.message
    });
  }
};

const search = async (req, res, next) => {
  try {
    const { q, limit = 50, skip = 0 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 2 characters'
      });
    }

    const db = req.app.locals.dbs.mainDb;
    const collection = db.collection('nas_files');

    const query = {
      $or: [
        { filename: new RegExp(q, 'i') },
        { path: new RegExp(q, 'i') }
      ]
    };

    const total = await collection.countDocuments(query);
    const results = await collection
      .find(query)
      .sort({ filename: 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    res.json({
      status: 'success',
      data: {
        query: q,
        results: results.map(file => ({
          ...file,
          sizeFormatted: formatFileSize(file.size),
          mtimeFormatted: new Date(file.mtime * 1000).toLocaleString()
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > (parseInt(skip) + parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('File search error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Search failed',
      error: error.message
    });
  }
};

module.exports = {
  browse,
  stats,
  search
};