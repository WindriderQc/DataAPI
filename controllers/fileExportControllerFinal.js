/**
 * Final Optimized File Export Controller
 * 
 * This version uses the optimized database structure:
 * 1. No redundant path field
 * 2. dirname fields have trailing slashes
 * 3. Simple path reconstruction: dirname + filename
 * 4. Maximum export efficiency
 */

const { formatFileSize } = require('../utils/file-operations');

async function generateFinalOptimizedReport(db, reportType) {
    const nasFiles = db.collection('nas_files');
    
    // Helper function for clean path reconstruction
    const getFullPath = (dirname, filename) => dirname + filename;
    
    switch (reportType) {
        case 'full':
            console.log('🚀 Generating final optimized full report...');
            const files = await nasFiles.find({})
                .sort({ dirname: 1, filename: 1 })
                .toArray();
                
            return {
                reportType: 'full_final',
                generatedAt: new Date().toISOString(),
                optimization: 'Removed path duplication + trailing slash optimization',
                totalFiles: files.length,
                files: files.map(file => ({
                    path: getFullPath(file.dirname, file.filename), // Clean reconstruction!
                    filename: file.filename,
                    dirname: file.dirname,
                    ext: file.ext,
                    size: file.size,
                    sizeFormatted: formatFileSize(file.size || 0),
                    mtime: file.mtime,
                    mtimeFormatted: file.mtime ? new Date(file.mtime * 1000).toISOString() : null
                }))
            };
            
        case 'summary':
            console.log('🚀 Generating final optimized directory summary...');
            
            // Use streaming approach to avoid memory limits
            const dirStats = new Map();
            const cursor = nasFiles.find({});
            
            while (await cursor.hasNext()) {
                const file = await cursor.next();
                const dirname = file.dirname;
                
                if (!dirStats.has(dirname)) {
                    dirStats.set(dirname, {
                        directory: dirname,
                        fileCount: 0,
                        totalSize: 0,
                        extensions: new Set(),
                        largestFile: null,
                        sampleFiles: []
                    });
                }
                
                const stats = dirStats.get(dirname);
                stats.fileCount++;
                stats.totalSize += file.size || 0;
                stats.extensions.add(file.ext);
                
                // Track largest file
                if (!stats.largestFile || (file.size || 0) > (stats.largestFile.size || 0)) {
                    stats.largestFile = {
                        filename: file.filename,
                        size: file.size || 0,
                        ext: file.ext,
                        fullPath: getFullPath(file.dirname, file.filename) // Clean path!
                    };
                }
                
                // Keep sample files
                if (stats.sampleFiles.length < 3) {
                    stats.sampleFiles.push({
                        filename: file.filename,
                        size: file.size || 0,
                        ext: file.ext,
                        path: getFullPath(file.dirname, file.filename) // Clean path!
                    });
                }
            }
            
            // Convert to array and sort
            const directories = Array.from(dirStats.values())
                .map(dir => ({
                    ...dir,
                    extensions: Array.from(dir.extensions),
                    averageFileSize: dir.fileCount > 0 ? Math.round(dir.totalSize / dir.fileCount) : 0
                }))
                .sort((a, b) => b.totalSize - a.totalSize);
            
            return {
                reportType: 'summary_final',
                generatedAt: new Date().toISOString(),
                optimization: 'Streaming aggregation + clean path reconstruction',
                totalDirectories: directories.length,
                totalFiles: directories.reduce((sum, dir) => sum + dir.fileCount, 0),
                totalSize: directories.reduce((sum, dir) => sum + dir.totalSize, 0),
                directories: directories.map(dir => ({
                    directory: dir.directory,
                    fileCount: dir.fileCount,
                    totalSize: dir.totalSize,
                    totalSizeFormatted: formatFileSize(dir.totalSize),
                    averageFileSize: dir.averageFileSize,
                    averageFileSizeFormatted: formatFileSize(dir.averageFileSize),
                    extensions: dir.extensions,
                    largestFile: dir.largestFile ? {
                        filename: dir.largestFile.filename,
                        size: dir.largestFile.size,
                        sizeFormatted: formatFileSize(dir.largestFile.size),
                        fullPath: dir.largestFile.fullPath,
                        ext: dir.largestFile.ext
                    } : null,
                    sampleFiles: dir.sampleFiles
                }))
            };
            
        case 'media':
            console.log('🚀 Generating final optimized media report...');
            
            const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
                                    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm',
                                    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
            
            const mediaFiles = [];
            const mediaCursor = nasFiles.find({ 
                ext: { $in: mediaExtensions }
            }).sort({ size: -1 });
            
            while (await mediaCursor.hasNext()) {
                const file = await mediaCursor.next();
                
                mediaFiles.push({
                    path: getFullPath(file.dirname, file.filename), // Clean path!
                    filename: file.filename,
                    dirname: file.dirname,
                    ext: file.ext,
                    size: file.size,
                    sizeFormatted: formatFileSize(file.size || 0),
                    mtime: file.mtime,
                    mtimeFormatted: file.mtime ? new Date(file.mtime * 1000).toISOString() : null
                });
            }
            
            return {
                reportType: 'media_final',
                generatedAt: new Date().toISOString(),
                optimization: 'Filtered media files + clean path reconstruction',
                mediaTypes: mediaExtensions,
                totalMediaFiles: mediaFiles.length,
                files: mediaFiles
            };
            
        case 'stats':
            console.log('🚀 Generating final optimized statistics...');
            
            // Get statistics using streaming to avoid memory limits
            const extStats = new Map();
            const statsCursor = nasFiles.find({});
            let totalFiles = 0;
            let totalSize = 0;
            
            while (await statsCursor.hasNext()) {
                const file = await statsCursor.next();
                const ext = file.ext || 'no-extension';
                const size = file.size || 0;
                
                if (!extStats.has(ext)) {
                    extStats.set(ext, {
                        count: 0,
                        totalSize: 0,
                        maxSize: 0,
                        samplePaths: []
                    });
                }
                
                const stats = extStats.get(ext);
                stats.count++;
                stats.totalSize += size;
                stats.maxSize = Math.max(stats.maxSize, size);
                
                if (stats.samplePaths.length < 3) {
                    stats.samplePaths.push(getFullPath(file.dirname, file.filename)); // Clean path!
                }
                
                totalFiles++;
                totalSize += size;
            }
            
            // Convert to sorted array
            const extensionStats = Array.from(extStats.entries())
                .map(([ext, stats]) => ({
                    extension: ext,
                    fileCount: stats.count,
                    totalSize: stats.totalSize,
                    totalSizeFormatted: formatFileSize(stats.totalSize),
                    averageSize: stats.count > 0 ? Math.round(stats.totalSize / stats.count) : 0,
                    averageSizeFormatted: formatFileSize(stats.count > 0 ? Math.round(stats.totalSize / stats.count) : 0),
                    maxSize: stats.maxSize,
                    maxSizeFormatted: formatFileSize(stats.maxSize),
                    percentageOfTotal: totalSize > 0 ? Math.round((stats.totalSize / totalSize) * 10000) / 100 : 0,
                    samplePaths: stats.samplePaths
                }))
                .sort((a, b) => b.totalSize - a.totalSize);
            
            return {
                reportType: 'statistics_final',
                generatedAt: new Date().toISOString(),
                optimization: 'Memory-efficient streaming + clean paths',
                overview: {
                    totalFiles,
                    totalSize,
                    totalSizeFormatted: formatFileSize(totalSize),
                    averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
                    averageFileSizeFormatted: formatFileSize(totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0)
                },
                extensionStats
            };
            
        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
}

module.exports = { generateFinalOptimizedReport };