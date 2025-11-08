const fs = require('fs/promises');
const path = require('path');
const { ObjectId } = require('mongodb');
const { 
  formatFileSize,
  validateFilename,
  ensureDir,
  exists,
  writeFileSafe,
  deleteFileSafe,
  listFilesWithMeta
} = require('../utils/file-operations');

// Export directory
const EXPORT_DIR = path.join(__dirname, '../public/exports');

const generateReport = async (req, res, next) => {
  try {
    const { type = 'full', format = 'json' } = req.query;
    
    const db = req.app.locals.dbs.mainDb;
    const collection = db.collection('nas_files');
    
    let filename, data;
    
    switch (type) {
      case 'full':
        filename = `files_full.${format}`;
        data = await generateFullReport(collection);
        break;
        
      case 'summary':
        filename = `files_summary.${format}`;
        data = await generateSummaryReport(collection);
        break;
        
      case 'media':
        filename = `files_media.${format}`;
        data = await generateMediaReport(collection);
        break;
        
      case 'large':
        filename = `files_large.${format}`;
        data = await generateLargeFilesReport(collection);
        break;
        
      case 'stats':
        filename = `files_stats.${format}`;
        data = await generateStatsReport(collection);
        break;
        
      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid report type. Use: full, summary, media, large, stats'
        });
    }
    
    const filePath = path.join(EXPORT_DIR, filename);
    
    // Write file based on format
    let success = false;
    if (format === 'json') {
      success = await writeFileSafe(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csv = convertToCSV(data);
      success = await writeFileSafe(filePath, csv);
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid format. Use: json, csv'
      });
    }
    
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to write export file'
      });
    }
    
    const stats = await fs.stat(filePath);
    
    res.json({
      status: 'success',
      data: {
        filename,
        path: `/exports/${filename}`,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        recordCount: Array.isArray(data.files) ? data.files.length : data.totalFiles || 0,
        generatedAt: new Date().toISOString(),
        downloadUrl: `/exports/${filename}`
      }
    });
    
  } catch (error) {
    console.error('File export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

const listReports = async (req, res, next) => {
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    
    const files = await fs.readdir(EXPORT_DIR);
    const reports = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(EXPORT_DIR, file);
        const stats = await fs.stat(filePath);
        
        reports.push({
          filename: file,
          path: `/exports/${file}`,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          modifiedAt: stats.mtime.toISOString(),
          downloadUrl: `/exports/${file}`
        });
      } catch (err) {
        // Skip files that can't be read
        continue;
      }
    }
    
    // Sort by modification time (newest first)
    reports.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    
    res.json({
      status: 'success',
      data: {
        reports,
        count: reports.length
      }
    });
    
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list reports',
      error: error.message
    });
  }
};

// Report generators
async function generateFullReport(collection) {
  const files = await collection.find({}).toArray();
  
  return {
    reportType: 'full',
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    files: files.map(file => ({
      path: file.path,
      filename: file.filename,
      dirname: file.dirname,
      ext: file.ext,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      mtime: file.mtime,
      mtimeFormatted: new Date(file.mtime * 1000).toISOString()
    }))
  };
}

async function generateSummaryReport(collection) {
  const pipeline = [
    {
      $group: {
        _id: '$dirname',
        fileCount: { $sum: 1 },
        totalSize: { $sum: '$size' },
        extensions: { $addToSet: '$ext' },
        sampleFiles: { $push: { filename: '$filename', size: '$size' } }
      }
    },
    {
      $project: {
        directory: '$_id',
        fileCount: 1,
        totalSize: 1,
        extensions: 1,
        sampleFiles: { $slice: ['$sampleFiles', 5] }
      }
    },
    { $sort: { totalSize: -1 } }
  ];
  
  const directories = await collection.aggregate(pipeline).toArray();
  
  return {
    reportType: 'summary',
    generatedAt: new Date().toISOString(),
    totalDirectories: directories.length,
    directories: directories.map(dir => ({
      ...dir,
      totalSizeFormatted: formatFileSize(dir.totalSize)
    }))
  };
}

async function generateMediaReport(collection) {
  const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'mp3', 'wav', 'flac', 'm4a'];
  
  const files = await collection.find({
    ext: { $in: mediaExtensions }
  }).sort({ size: -1 }).toArray();
  
  return {
    reportType: 'media',
    generatedAt: new Date().toISOString(),
    totalMediaFiles: files.length,
    supportedExtensions: mediaExtensions,
    files: files.map(file => ({
      path: file.path,
      filename: file.filename,
      ext: file.ext,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      mtime: file.mtime,
      mtimeFormatted: new Date(file.mtime * 1000).toISOString()
    }))
  };
}

async function generateLargeFilesReport(collection) {
  const files = await collection.find({
    size: { $gt: 100 * 1024 * 1024 } // > 100MB
  }).sort({ size: -1 }).limit(1000).toArray();
  
  return {
    reportType: 'large',
    generatedAt: new Date().toISOString(),
    threshold: '100MB',
    totalLargeFiles: files.length,
    files: files.map(file => ({
      path: file.path,
      filename: file.filename,
      ext: file.ext,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      mtime: file.mtime,
      mtimeFormatted: new Date(file.mtime * 1000).toISOString()
    }))
  };
}

async function generateStatsReport(collection) {
  // Extension stats
  const extensionStats = await collection.aggregate([
    {
      $group: {
        _id: '$ext',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  // Size distribution
  const sizeStats = await collection.aggregate([
    {
      $bucket: {
        groupBy: '$size',
        boundaries: [0, 1024, 1024*1024, 10*1024*1024, 100*1024*1024, 1024*1024*1024, Infinity],
        default: 'Other',
        output: {
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    }
  ]).toArray();
  
  const totalStats = await collection.aggregate([
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' },
        minSize: { $min: '$size' },
        maxSize: { $max: '$size' }
      }
    }
  ]).toArray();
  
  return {
    reportType: 'stats',
    generatedAt: new Date().toISOString(),
    overview: {
      ...totalStats[0],
      totalSizeFormatted: formatFileSize(totalStats[0]?.totalSize || 0),
      avgSizeFormatted: formatFileSize(totalStats[0]?.avgSize || 0),
      minSizeFormatted: formatFileSize(totalStats[0]?.minSize || 0),
      maxSizeFormatted: formatFileSize(totalStats[0]?.maxSize || 0)
    },
    extensionStats: extensionStats.map(stat => ({
      ...stat,
      totalSizeFormatted: formatFileSize(stat.totalSize),
      avgSizeFormatted: formatFileSize(stat.avgSize)
    })),
    sizeDistribution: sizeStats.map((bucket, index) => {
      const ranges = ['0-1KB', '1KB-1MB', '1MB-10MB', '10MB-100MB', '100MB-1GB', '1GB+'];
      return {
        range: ranges[index] || bucket._id,
        count: bucket.count,
        totalSize: bucket.totalSize,
        totalSizeFormatted: formatFileSize(bucket.totalSize)
      };
    })
  };
}

// Utility functions
function convertToCSV(data) {
  if (!data.files || !Array.isArray(data.files)) {
    return 'No data available\n';
  }
  
  const headers = Object.keys(data.files[0] || {});
  const csvHeaders = headers.join(',');
  
  const csvRows = data.files.map(file => 
    headers.map(header => {
      const value = file[header];
      // Escape commas and quotes in CSV
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

// List available export files
const listExports = async (req, res, next) => {
    try {
        const exportDir = path.join(__dirname, '../public/exports');
        
        // Ensure directory exists
        await ensureDir(exportDir);
        
        // Get file list with metadata
        const fileStats = await listFilesWithMeta(exportDir, {
            filesOnly: true,
            sortBy: 'modified',
            sortOrder: 'desc'
        });

        res.json({
            status: 'success',
            message: `Found ${fileStats.length} export files`,
            data: fileStats
        });
    } catch (error) {
        console.error('Error listing exports:', error);
        next(error);
    }
};

// Delete an export file
const deleteExport = async (req, res, next) => {
    try {
        const { filename } = req.params;
        
        // Validate filename (security check)
        if (!validateFilename(filename)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid filename'
            });
        }

        const filePath = path.join(__dirname, '../public/exports', filename);
        
        if (!exists(filePath)) {
            return res.status(404).json({
                status: 'error',
                message: 'Export file not found'
            });
        }

        const success = await deleteFileSafe(filePath);
        
        if (success) {
            res.json({
                status: 'success',
                message: 'Export file deleted successfully'
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete export file'
            });
        }
    } catch (error) {
        console.error('Error deleting export:', error);
        next(error);
    }
};

module.exports = {
  generateReport,
  listExports,
  deleteExport
};