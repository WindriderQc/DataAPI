const { log } = require('../utils/logger');
const config = require('../config/config');

async function seedData(app) {
    if (!app.locals.dbs || !app.locals.dbs.mainDb) {
        throw new Error('Database connection not established.');
    }

    const db = app.locals.dbs.mainDb;

    try {
        // Ensure default location is configured for weather tracking
        const weatherLocationsCollection = db.collection('weatherLocations');
        const defaultLocation = { lat: 46.8138, lon: -71.208 };
        const existingLocation = await weatherLocationsCollection.findOne(defaultLocation);
        if (!existingLocation) {
            await weatherLocationsCollection.insertOne(defaultLocation);
            log('Created default weather location for Quebec City.');
        }

        // Initialize default profiles (Admin and User)
        const profilesCollection = db.collection('profiles');

        // Create Admin profile if it doesn't exist
        const adminProfile = await profilesCollection.findOne({ profileName: 'Admin' });
        if (!adminProfile) {
            await profilesCollection.insertOne({
                profileName: 'Admin',
                isAdmin: true,
                config: []
            });
            log('Created default Admin profile.');
        }

        // Create User profile if it doesn't exist
        const userProfile = await profilesCollection.findOne({ profileName: 'User' });
        if (!userProfile) {
            await profilesCollection.insertOne({
                profileName: 'User',
                isAdmin: false,
                config: []
            });
            log('Created default User profile.');
        }
    } catch (error) {
        log(`Error seeding data: ${error.message}`, 'error');
        throw error;
    }
}

module.exports = seedData;
