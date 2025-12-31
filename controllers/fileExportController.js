/**
 * File Export Controller
 * 
 * Unified controller handling all file export operations.
 * Consolidates logic from previous optimized/fixed versions.
 * 
 * Features:
 * - Optimized memory usage for large datasets
 * - Handles 'nas_files' and 'nas_directories' collections
 * - Reconstructs paths on-the-fly (dirname + filename)
 */

const fs = require('fs/promises');
const path = require('path');
const {
    formatFileSize,
    validateFilename,
    ensureDir,
    exists,
    deleteFileSafe,
    listFilesWithMeta,
    writeFileSafe
} = require('../utils/file-operations');
const { generateFilenameTimestamp } = require('../utils/date-utils');

// Export directory
const EXPORT_DIR = path.join(__dirname, '../public/exports');

class OptimizedExportController {
    constructor(db) {
        this.db = db;
        this.nasFiles = db.collection('nas_files');
        this.nasDirectories = db.collection('nas_directories');
    }

    /**
     * Generate optimized full report
     */
    async generateOptimizedFullReport() {
        console.log('🚀 Generating optimized full report...');

        // Use simple approach: iterate files and reconstruct paths
        const files = [];
        const cursor = this.nasFiles.find({}).sort({ dirname: 1, filename: 1 });

        // We use a streaming approach or chunking if needed, but here we build the array
        // If memory is an issue, this should be converted to a stream to file directly.
        // For now, mirroring the logic from fileExportControllerOptimized.js

        let count = 0;
        while (await cursor.hasNext()) {
            const file = await cursor.next();

            // Reconstruct path from dirname + filename
            const fullPath = (file.dirname || '') + '/' + (file.filename || '');

            files.push({
                path: fullPath,
                filename: file.filename,
                dirname: file.dirname,
                ext: file.ext,
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                mtime: file.mtime,
                mtimeFormatted: file.mtime ? new Date(file.mtime * 1000).toISOString() : null
            });

            count++;
            if (count % 10000 === 0) {
                console.log(`   Processed: ${count} files`);
            }
        }

        console.log(`✅ Optimized report generated: ${files.length} files`);

        return {
            reportType: 'full_optimized',
            generatedAt: new Date().toISOString(),
            optimization: 'Removed redundant path storage',
            totalFiles: files.length,
            files
        };
    }

    /**
     * Generate ultra-efficient summary using pre-calculated directory stats
     */
    async generateOptimizedSummary() {
        console.log('🚀 Generating optimized summary...');

        // Try to use nas_directories first
        let directories = await this.nasDirectories
            .find({})
            .sort({ total_size: -1 })
            .toArray();

        // Fallback: if nas_directories is empty, we might need to aggregate nas_files
        // But for now we assume the optimized structure exists if this controller is being used.
        if (directories.length === 0) {
            console.warn('⚠️ nas_directories empty, falling back to nas_files aggregation');
            // Fallback aggregation (borrowed from legacy logic but optimized)
            directories = await this.nasFiles.aggregate([
                {
                    $group: {
                        _id: '$dirname',
                        file_count: { $sum: 1 },
                        total_size: { $sum: '$size' },
                        // sample files would be complex here, keeping it simple
                    }
                },
                { $sort: { total_size: -1 } }
            ]).toArray();

            // Map aggregation result to expected structure
            directories = directories.map(d => ({
                path: d._id,
                file_count: d.file_count,
                total_size: d.total_size,
                sample_files: []
            }));
        }

        return {
            reportType: 'summary_optimized',
            generatedAt: new Date().toISOString(),
            optimization: 'Uses pre-calculated directory statistics',
            totalDirectories: directories.length,
            totalFiles: directories.reduce((sum, dir) => sum + dir.file_count || 0, 0),
            totalSize: directories.reduce((sum, dir) => sum + dir.total_size || 0, 0),
            directories: directories.map(dir => ({
                directory: dir.path,
                fileCount: dir.file_count,
                totalSize: dir.total_size,
                totalSizeFormatted: formatFileSize(dir.total_size),
                averageFileSize: dir.file_count > 0 ? Math.round(dir.total_size / dir.file_count) : 0,
                sampleFiles: dir.sample_files || []
            }))
        };
    }

    /**
     * Generate media-only report (images, videos, audio)
     */
    async generateOptimizedMediaReport() {
        console.log('🚀 Generating optimized media report...');

        const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
            'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm',
            'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];

        const mediaFiles = [];
        const cursor = this.nasFiles.find({
            ext: { $in: mediaExtensions }
        }).sort({ size: -1 });

        while (await cursor.hasNext()) {
            const file = await cursor.next();

            mediaFiles.push({
                path: (file.dirname || '') + '/' + (file.filename || ''),
                filename: file.filename,
                dirname: file.dirname,
                ext: file.ext,
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                mtime: file.mtime,
                mtimeFormatted: file.mtime ? new Date(file.mtime * 1000).toISOString() : null
            });
        }

        console.log(`✅ Optimized media report: ${mediaFiles.length} files`);

        return {
            reportType: 'media_optimized',
            generatedAt: new Date().toISOString(),
            optimization: 'Filtered media files with reconstructed paths',
            mediaTypes: mediaExtensions,
            totalMediaFiles: mediaFiles.length,
            files: mediaFiles
        };
    }

    /**
     * Generate large files report (files > 100MB)
     */
    async generateOptimizedLargeFilesReport() {
        console.log('🚀 Generating large files report...');

        const minSize = 100 * 1024 * 1024; // 100MB in bytes
        const largeFiles = [];
        const cursor = this.nasFiles.find({
            size: { $gte: minSize }
        }).sort({ size: -1 });

        while (await cursor.hasNext()) {
            const file = await cursor.next();

            largeFiles.push({
                path: (file.dirname || '') + '/' + (file.filename || ''),
                filename: file.filename,
                dirname: file.dirname,
                ext: file.ext,
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                mtime: file.mtime,
                mtimeFormatted: file.mtime ? new Date(file.mtime * 1000).toISOString() : null
            });
        }

        console.log(`✅ Large files report: ${largeFiles.length} files`);

        return {
            reportType: 'large_files_optimized',
            generatedAt: new Date().toISOString(),
            optimization: 'Files larger than 100MB',
            minSizeBytes: minSize,
            minSizeFormatted: formatFileSize(minSize),
            totalLargeFiles: largeFiles.length,
            files: largeFiles
        };
    }

    /**
     * Generate statistics report
     */
    async generateOptimizedStatsReport() {
        console.log('🚀 Generating optimized statistics report...');

        // Get file stats by extension
        const statsByExt = await this.nasFiles.aggregate([
            {
                $group: {
                    _id: '$ext',
                    count: { $sum: 1 },
                    totalSize: { $sum: '$size' },
                    avgSize: { $avg: '$size' },
                    maxSize: { $max: '$size' }
                }
            },
            { $sort: { totalSize: -1 } }
        ]).toArray();

        // Get directory stats
        const directories = await this.nasDirectories.find({}).toArray();
        let totalFiles = 0;
        let totalSize = 0;

        if (directories.length > 0) {
            totalFiles = directories.reduce((sum, dir) => sum + dir.file_count, 0);
            totalSize = directories.reduce((sum, dir) => sum + dir.total_size, 0);
        } else {
            // Fallback if nas_directories empty
            totalFiles = await this.nasFiles.countDocuments();
            // Approximating total size from extension stats if directories missing
            totalSize = statsByExt.reduce((sum, stat) => sum + stat.totalSize, 0);
        }

        return {
            reportType: 'statistics_optimized',
            generatedAt: new Date().toISOString(),
            optimization: 'Pre-calculated aggregations, no path duplication',
            overview: {
                totalFiles,
                totalSize,
                totalSizeFormatted: formatFileSize(totalSize),
                uniqueDirectories: directories.length,
                averageFilesPerDirectory: directories.length > 0 ? Math.round(totalFiles / directories.length) : 0,
                averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
            },
            extensionStats: statsByExt.map(stat => ({
                extension: stat._id || 'no-extension',
                fileCount: stat.count,
                totalSize: stat.totalSize,
                totalSizeFormatted: formatFileSize(stat.totalSize),
                averageSize: Math.round(stat.avgSize),
                averageSizeFormatted: formatFileSize(Math.round(stat.avgSize)),
                maxSize: stat.maxSize,
                maxSizeFormatted: formatFileSize(stat.maxSize),
                percentageOfTotal: totalSize > 0 ? Math.round((stat.totalSize / totalSize) * 100 * 100) / 100 : 0
            })),
            topDirectories: directories
                .sort((a, b) => b.total_size - a.total_size)
                .slice(0, 20)
                .map(dir => ({
                    directory: dir.path,
                    fileCount: dir.file_count,
                    totalSize: dir.total_size,
                    totalSizeFormatted: formatFileSize(dir.total_size),
                    percentageOfTotal: totalSize > 0 ? Math.round((dir.total_size / totalSize) * 100 * 100) / 100 : 0
                }))
        };
    }
}

// ---- Controller Functions ----

// 1. generateOptimizedReport (Direct API usage)
async function generateOptimizedReport(db, reportType) {
    const controller = new OptimizedExportController(db);

    switch (reportType) {
        case 'full':
            return await controller.generateOptimizedFullReport();
        case 'summary':
            return await controller.generateOptimizedSummary();
        case 'media':
            return await controller.generateOptimizedMediaReport();
        case 'large':
            return await controller.generateOptimizedLargeFilesReport();
        case 'stats':
            return await controller.generateOptimizedStatsReport();
        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
}

// 2. generateReport (Legacy API wrapper - handles POST /files/export)
const generateReport = async (req, res, next) => {
    try {
        const { type = 'full', format = 'json' } = req.query; // or req.body depending on POST
        // req.query is standard for the GET, but this route is defined as POST in api.routes.js:
        // router.post('/files/export', fileExportController.generateReport);
        // So arguments likely in req.body, but original code checked req.query...
        // Let's check both to be safe
        const rType = req.body.type || req.query.type || 'full';
        const rFormat = req.body.format || req.query.format || 'json';

        const db = req.app.locals.dbs.mainDb;

        // Use the optimized generation logic
        let data;
        try {
            data = await generateOptimizedReport(db, rType);
        } catch (e) {
            if (e.message.startsWith('Unknown report type')) {
                return res.status(400).json({ status: 'error', message: e.message });
            }
            throw e;
        }

        // Generate timestamp for filename: YYYY-MM-DD_HH-mm-ss (UTC)
        const timestamp = generateFilenameTimestamp();

        const filename = `files_${rType}_optimized_${timestamp}.${rFormat}`;
        const filePath = path.join(EXPORT_DIR, filename);
        await ensureDir(EXPORT_DIR);

        // Write file based on format
        let success = false;
        if (rFormat === 'json') {
            success = await writeFileSafe(filePath, JSON.stringify(data, null, 2));
        } else if (rFormat === 'csv') {
            const csv = convertToCSV(data);
            success = await writeFileSafe(filePath, csv);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid format. Use: json, csv'
            });
        }

        if (!success) {
            throw new Error('Failed to write export file');
        }

        const stats = await fs.stat(filePath);

        res.json({
            status: 'success',
            data: {
                filename,
                path: `/exports/${filename}`,
                size: stats.size,
                sizeFormatted: formatFileSize(stats.size),
                recordCount: Array.isArray(data.files) ? data.files.length : (data.totalFiles || 0),
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

// 3. listExports
const listExports = async (req, res, next) => {
    try {
        await ensureDir(EXPORT_DIR);
        const fileStats = await listFilesWithMeta(EXPORT_DIR, {
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

// 4. deleteExport
const deleteExport = async (req, res, next) => {
    try {
        const { filename } = req.params;

        if (!validateFilename(filename)) {
            return res.status(400).json({ status: 'error', message: 'Invalid filename' });
        }

        const filePath = path.join(EXPORT_DIR, filename);
        if (!exists(filePath)) {
            return res.status(404).json({ status: 'error', message: 'Export file not found' });
        }

        const success = await deleteFileSafe(filePath);
        if (success) {
            res.json({ status: 'success', message: 'Export file deleted successfully' });
        } else {
            res.status(500).json({ status: 'error', message: 'Failed to delete export file' });
        }
    } catch (error) {
        console.error('Error deleting export:', error);
        next(error);
    }
};

// Helper: convertToCSV
function convertToCSV(data) {
    // Handle different structures based on report type
    const list = data.files || data.directories || data.extensionStats || [];

    if (!Array.isArray(list) || list.length === 0) {
        return 'No data available\n';
    }

    const headers = Object.keys(list[0] || {});
    const csvHeaders = headers.join(',');

    const csvRows = list.map(item =>
        headers.map(header => {
            const value = item[header];
            if (Array.isArray(value)) return `"${value.length} items"`;
            if (typeof value === 'object' && value !== null) return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            return typeof value === 'string' && value.includes(',')
                ? `"${value.replace(/"/g, '""')}"`
                : value;
        }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
}

module.exports = {
    generateReport,
    generateOptimizedReport,
    listExports,
    deleteExport,
    OptimizedExportController
};