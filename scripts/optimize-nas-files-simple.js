/**
 * Simple Database Optimization for nas_files collection
 * Memory-efficient approach using streaming and batching
 */

const { MongoClient } = require('mongodb');

async function optimizeDatabase() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://yb:zigzag@cluster0-b2xaf.mongodb.net/';
    const dbName = 'datas';
    
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    
    console.log('🚀 Starting simple database optimization...');
    console.log('Method: Stream processing to avoid memory limits\n');

    const nasFiles = db.collection('nas_files');
    const nasDirectories = db.collection('nas_directories');
    
    try {
        // Step 1: Extract unique directories using streaming
        console.log('📁 Step 1: Extracting unique directories...');
        
        const uniqueDirs = new Map();
        const cursor = nasFiles.find({});
        let fileCount = 0;
        
        while (await cursor.hasNext()) {
            const file = await cursor.next();
            const dirname = file.dirname;
            
            if (!uniqueDirs.has(dirname)) {
                uniqueDirs.set(dirname, {
                    path: dirname,
                    file_count: 0,
                    total_size: 0,
                    sample_files: []
                });
            }
            
            const dir = uniqueDirs.get(dirname);
            dir.file_count++;
            dir.total_size += file.size || 0;
            
            if (dir.sample_files.length < 3) {
                dir.sample_files.push({
                    filename: file.filename,
                    size: file.size
                });
            }
            
            fileCount++;
            if (fileCount % 10000 === 0) {
                console.log(`   Processed: ${fileCount} files, ${uniqueDirs.size} unique directories`);
            }
        }
        
        console.log(`✅ Found ${uniqueDirs.size} unique directories from ${fileCount} files`);
        
        // Step 2: Insert directories in batches
        console.log('\n💾 Step 2: Saving directories...');
        
        // Drop existing collection if it exists
        try {
            await nasDirectories.drop();
            console.log('   Dropped existing nas_directories collection');
        } catch (e) {
            // Collection doesn't exist, which is fine
        }
        
        const directories = Array.from(uniqueDirs.values());
        const batchSize = 1000;
        
        for (let i = 0; i < directories.length; i += batchSize) {
            const batch = directories.slice(i, i + batchSize);
            await nasDirectories.insertMany(batch);
            console.log(`   Saved: ${Math.min(i + batchSize, directories.length)}/${directories.length} directories`);
        }
        
        await nasDirectories.createIndex({ path: 1 }, { unique: true });
        console.log('✅ Created index on directory paths');
        
        // Step 3: Show storage analysis
        console.log('\n📊 Storage Analysis:');
        console.log('=====================================');
        
        // Calculate current storage usage
        const avgPathLength = fileCount > 0 ? Math.round(
            Array.from(uniqueDirs.values()).reduce((sum, dir) => sum + dir.path.length * dir.file_count, 0) / fileCount
        ) : 0;
        
        const avgFilenameLength = 50; // Estimate
        const currentStoragePerFile = avgPathLength + avgFilenameLength; // path + filename
        const optimizedStoragePerFile = 12 + avgFilenameLength; // ObjectId + filename
        
        const totalCurrentBytes = fileCount * currentStoragePerFile;
        const totalOptimizedBytes = fileCount * optimizedStoragePerFile;
        const savedBytes = totalCurrentBytes - totalOptimizedBytes;
        const savedPercentage = Math.round((savedBytes / totalCurrentBytes) * 100);
        
        console.log(`📁 Total files: ${fileCount.toLocaleString()}`);
        console.log(`📂 Unique directories: ${uniqueDirs.size.toLocaleString()}`);
        console.log(`📏 Average path length: ${avgPathLength} chars`);
        console.log(`💾 Current storage: ~${Math.round(totalCurrentBytes / 1024 / 1024)} MB`);
        console.log(`🎯 Optimized storage: ~${Math.round(totalOptimizedBytes / 1024 / 1024)} MB`);
        console.log(`💰 Savings: ~${Math.round(savedBytes / 1024 / 1024)} MB (${savedPercentage}%)`);
        
        console.log('\n🔍 Sample directories by file count:');
        const topDirs = directories
            .sort((a, b) => b.file_count - a.file_count)
            .slice(0, 10);
            
        topDirs.forEach((dir, i) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${dir.path.substring(0, 60)}${dir.path.length > 60 ? '...' : ''}`);
            console.log(`     Files: ${dir.file_count}, Size: ${Math.round(dir.total_size / 1024 / 1024)} MB`);
        });
        
        console.log('\n📤 Next Steps for Export Optimization:');
        console.log('1. Update fileExportController to use nas_directories lookup');
        console.log('2. Remove path duplication from export data');
        console.log('3. Expected export size reduction: ~60%');
        console.log('4. Keep original nas_files as backup until verified');
        
    } catch (error) {
        console.error('❌ Optimization failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run if executed directly
if (require.main === module) {
    optimizeDatabase().catch(console.error);
}

module.exports = { optimizeDatabase };