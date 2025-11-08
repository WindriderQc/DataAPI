/**
 * Enhanced Directory Analysis with Largest Files
 * 
 * This script provides detailed directory analysis including:
 * - Directory size and file count
 * - Largest file in each directory
 * - File type breakdown
 * - Space usage insights
 */

const { MongoClient } = require('mongodb');
const { formatFileSize } = require('../utils/file-operations');

class EnhancedDirectoryAnalyzer {
    constructor(mongoUrl, dbName) {
        this.mongoUrl = mongoUrl;
        this.dbName = dbName;
        this.client = null;
        this.db = null;
    }

    async connect() {
        this.client = new MongoClient(this.mongoUrl);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        console.log(`✅ Connected to MongoDB: ${this.dbName}`);
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('✅ Disconnected from MongoDB');
        }
    }

    /**
     * Get enhanced directory analysis with largest files
     */
    async getEnhancedDirectoryStats() {
        console.log('\n📊 Generating Enhanced Directory Analysis...');
        
        const nasFiles = this.db.collection('nas_files');
        
        // Use streaming approach to avoid memory issues
        const dirStats = new Map();
        const cursor = nasFiles.find({}).sort({ size: -1 }); // Sort by size descending
        
        let processedFiles = 0;
        
        while (await cursor.hasNext()) {
            const file = await cursor.next();
            const dirname = file.dirname;
            
            if (!dirStats.has(dirname)) {
                dirStats.set(dirname, {
                    directory: dirname,
                    fileCount: 0,
                    totalSize: 0,
                    largestFile: null,
                    extensions: new Set(),
                    sampleFiles: []
                });
            }
            
            const stats = dirStats.get(dirname);
            stats.fileCount++;
            stats.totalSize += file.size || 0;
            stats.extensions.add(file.ext);
            
            // Track largest file (first one due to sort by size desc)
            if (!stats.largestFile || (file.size || 0) > (stats.largestFile.size || 0)) {
                stats.largestFile = {
                    filename: file.filename,
                    size: file.size || 0,
                    ext: file.ext,
                    mtime: file.mtime,
                    fullPath: dirname + '/' + file.filename
                };
            }
            
            // Keep some sample files
            if (stats.sampleFiles.length < 3) {
                stats.sampleFiles.push({
                    filename: file.filename,
                    size: file.size || 0,
                    ext: file.ext
                });
            }
            
            processedFiles++;
            if (processedFiles % 10000 === 0) {
                console.log(`   Processed: ${processedFiles} files, ${dirStats.size} directories...`);
            }
        }
        
        console.log(`✅ Analysis complete: ${processedFiles} files in ${dirStats.size} directories`);
        
        // Convert Map to Array and sort by total size
        const sortedDirs = Array.from(dirStats.values())
            .map(dir => ({
                ...dir,
                extensions: Array.from(dir.extensions),
                averageFileSize: dir.fileCount > 0 ? Math.round(dir.totalSize / dir.fileCount) : 0
            }))
            .sort((a, b) => b.totalSize - a.totalSize);
        
        return sortedDirs;
    }

    /**
     * Display enhanced directory report
     */
    async generateEnhancedReport() {
        console.log('🚀 Starting Enhanced Directory Analysis...\n');
        
        try {
            await this.connect();
            
            const directories = await this.getEnhancedDirectoryStats();
            const totalFiles = directories.reduce((sum, dir) => sum + dir.fileCount, 0);
            const totalSize = directories.reduce((sum, dir) => sum + dir.totalSize, 0);
            
            console.log('\n📈 ENHANCED DIRECTORY ANALYSIS');
            console.log('================================================');
            console.log(`📁 Total directories: ${directories.length.toLocaleString()}`);
            console.log(`📄 Total files: ${totalFiles.toLocaleString()}`);
            console.log(`💾 Total size: ${formatFileSize(totalSize)}`);
            console.log(`📊 Average files per directory: ${Math.round(totalFiles / directories.length)}`);
            
            console.log('\n🎯 TOP 15 LARGEST DIRECTORIES WITH LARGEST FILES:');
            console.log('==================================================');
            
            directories.slice(0, 15).forEach((dir, index) => {
                const rank = (index + 1).toString().padStart(2, ' ');
                const dirPath = dir.directory.length > 60 
                    ? dir.directory.substring(0, 57) + '...' 
                    : dir.directory;
                
                console.log(`\n${rank}. 📂 ${dirPath}`);
                console.log(`    📊 ${dir.fileCount.toLocaleString()} files • ${formatFileSize(dir.totalSize)} • Avg: ${formatFileSize(dir.averageFileSize)}`);
                console.log(`    📋 Types: ${dir.extensions.slice(0, 5).join(', ')}${dir.extensions.length > 5 ? '...' : ''}`);
                
                if (dir.largestFile) {
                    const largestFile = dir.largestFile;
                    const fileName = largestFile.filename.length > 40 
                        ? largestFile.filename.substring(0, 37) + '...' 
                        : largestFile.filename;
                    
                    const fileAge = largestFile.mtime 
                        ? new Date(largestFile.mtime * 1000).toLocaleDateString()
                        : 'Unknown';
                    
                    console.log(`    🔥 Largest: ${fileName} (${formatFileSize(largestFile.size)}) • ${fileAge}`);
                } else {
                    console.log(`    🔥 Largest: No files found`);
                }
                
                // Show percentage of total storage
                const percentage = ((dir.totalSize / totalSize) * 100).toFixed(1);
                console.log(`    💯 ${percentage}% of total storage`);
            });
            
            // Find directories with unusually large single files
            console.log('\n🚨 DIRECTORIES WITH EXCEPTIONALLY LARGE FILES:');
            console.log('===============================================');
            
            const dirsWithLargeFiles = directories
                .filter(dir => dir.largestFile && dir.largestFile.size > 100 * 1024 * 1024) // > 100MB
                .sort((a, b) => b.largestFile.size - a.largestFile.size)
                .slice(0, 10);
            
            if (dirsWithLargeFiles.length > 0) {
                dirsWithLargeFiles.forEach((dir, index) => {
                    const rank = (index + 1).toString().padStart(2, ' ');
                    const dirPath = dir.directory.length > 50 
                        ? dir.directory.substring(0, 47) + '...' 
                        : dir.directory;
                    
                    console.log(`${rank}. 📂 ${dirPath}`);
                    console.log(`    🔥 ${dir.largestFile.filename} (${formatFileSize(dir.largestFile.size)})`);
                    
                    // Show what percentage this single file is of the directory
                    const filePercentage = ((dir.largestFile.size / dir.totalSize) * 100).toFixed(1);
                    console.log(`    📊 ${filePercentage}% of directory space`);
                });
            } else {
                console.log('   No files larger than 100MB found.');
            }
            
            // Extension analysis
            console.log('\n📋 FILE TYPE ANALYSIS:');
            console.log('======================');
            
            const extStats = new Map();
            directories.forEach(dir => {
                dir.extensions.forEach(ext => {
                    if (!extStats.has(ext)) {
                        extStats.set(ext, { directories: 0, totalFiles: 0 });
                    }
                    extStats.get(ext).directories++;
                });
            });
            
            const topExtensions = Array.from(extStats.entries())
                .sort((a, b) => b[1].directories - a[1].directories)
                .slice(0, 10);
            
            topExtensions.forEach(([ext, stats], index) => {
                console.log(`${(index + 1).toString().padStart(2)}. .${ext || 'no-ext'}: Found in ${stats.directories} directories`);
            });
            
            console.log('\n✨ INSIGHTS & RECOMMENDATIONS:');
            console.log('==============================');
            
            // Find directories that might need cleanup
            const largeButFewFiles = directories.filter(dir => 
                dir.totalSize > 1024 * 1024 * 1024 && // > 1GB
                dir.fileCount < 50 // but less than 50 files
            ).slice(0, 5);
            
            if (largeButFewFiles.length > 0) {
                console.log('🧹 Large directories with few files (potential cleanup targets):');
                largeButFewFiles.forEach(dir => {
                    console.log(`   📂 ${dir.directory}`);
                    console.log(`      ${formatFileSize(dir.totalSize)} in only ${dir.fileCount} files`);
                });
            }
            
            // Find directories with many small files
            const manySmallFiles = directories.filter(dir =>
                dir.fileCount > 1000 && // > 1000 files
                dir.averageFileSize < 1024 * 1024 // but avg < 1MB
            ).slice(0, 5);
            
            if (manySmallFiles.length > 0) {
                console.log('\n📦 Directories with many small files (potential archive candidates):');
                manySmallFiles.forEach(dir => {
                    console.log(`   📂 ${dir.directory}`);
                    console.log(`      ${dir.fileCount} files, avg size: ${formatFileSize(dir.averageFileSize)}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            throw error;
        } finally {
            await this.disconnect();
        }
    }
}

// Export for use in other scripts
module.exports = { EnhancedDirectoryAnalyzer };

// Allow running directly
if (require.main === module) {
    const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://yb:zigzag@cluster0-b2xaf.mongodb.net/';
    const dbName = process.env.DB_NAME || 'datas';
    
    const analyzer = new EnhancedDirectoryAnalyzer(mongoUrl, dbName);
    analyzer.generateEnhancedReport().catch(console.error);
}