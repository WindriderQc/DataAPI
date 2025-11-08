/**
 * Add trailing slash to dirname fields for cleaner path reconstruction
 * 
 * This makes path reconstruction simpler:
 * BEFORE: path = dirname + "/" + filename
 * AFTER:  path = dirname + filename (dirname already has trailing /)
 */

const { MongoClient } = require('mongodb');

async function addTrailingSlashes() {
    const mongoUrl = 'mongodb+srv://yb:zigzag@cluster0-b2xaf.mongodb.net/';
    const dbName = 'datas';
    
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    
    console.log('🚀 Adding trailing slashes to dirname fields...\n');
    
    try {
        const nasFiles = db.collection('nas_files');
        
        // First, check current structure
        console.log('📊 Analyzing current dirname structure...');
        const sample = await nasFiles.findOne();
        console.log('Current sample dirname:', `"${sample.dirname}"`);
        console.log('Current reconstruction:', `"${sample.dirname + '/' + sample.filename}"`);
        
        // Count how many need updating
        const countWithoutSlash = await nasFiles.countDocuments({
            dirname: { $not: /\/$/ } // dirname doesn't end with slash
        });
        
        const countWithSlash = await nasFiles.countDocuments({
            dirname: /\/$/ // dirname ends with slash
        });
        
        console.log(`📁 Directories without trailing slash: ${countWithoutSlash.toLocaleString()}`);
        console.log(`📁 Directories with trailing slash: ${countWithSlash.toLocaleString()}`);
        
        if (countWithoutSlash === 0) {
            console.log('\n✅ All dirname fields already have trailing slashes!');
            return;
        }
        
        console.log(`\n🔧 Updating ${countWithoutSlash.toLocaleString()} dirname fields...`);
        
        // Update all dirname fields that don't end with slash
        const result = await nasFiles.updateMany(
            { dirname: { $not: /\/$/ } }, // Find dirname without trailing slash
            [
                {
                    $set: {
                        dirname: { $concat: ["$dirname", "/"] } // Add trailing slash
                    }
                }
            ]
        );
        
        console.log(`✅ Updated ${result.modifiedCount} documents`);
        
        // Verify the change
        const updatedSample = await nasFiles.findOne();
        console.log('\n📊 After update:');
        console.log('New sample dirname:', `"${updatedSample.dirname}"`);
        console.log('New reconstruction:', `"${updatedSample.dirname + updatedSample.filename}"`);
        
        // Test path reconstruction comparison
        console.log('\n🧪 Path Reconstruction Test:');
        const testFiles = await nasFiles.find({}).limit(3).toArray();
        
        testFiles.forEach((file, index) => {
            const oldWay = file.dirname.replace(/\/$/, '') + '/' + file.filename; // Remove slash, add slash
            const newWay = file.dirname + file.filename; // Direct concat
            const match = oldWay === newWay;
            
            console.log(`${index + 1}. ${match ? '✅' : '❌'} ${file.filename}`);
            console.log(`   Old way: "${oldWay}"`);
            console.log(`   New way: "${newWay}"`);
        });
        
        console.log('\n🎯 OPTIMIZATION COMPLETE!');
        console.log('=====================================');
        console.log(`✅ Updated ${result.modifiedCount} dirname fields`);
        console.log('✅ All dirname fields now have trailing slashes');
        console.log('✅ Path reconstruction simplified: dirname + filename');
        console.log('✅ Export code can be cleaner and faster');
        
        console.log('\n📝 Update your export code to use:');
        console.log('   // OLD: const path = file.dirname + "/" + file.filename;');
        console.log('   // NEW: const path = file.dirname + file.filename;');
        
    } catch (error) {
        console.error('❌ Update failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run if executed directly
if (require.main === module) {
    addTrailingSlashes().catch(console.error);
}

module.exports = { addTrailingSlashes };