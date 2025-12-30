const mongoose = require('mongoose');
const config = require('../config/config');

const LiveDataConfigSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true,
        unique: true, // 'liveDataEnabled', 'iss', 'quakes', 'weather'
        enum: ['liveDataEnabled', 'iss', 'quakes', 'weather']
    },
    enabled: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Static method to ensure default configuration exists
LiveDataConfigSchema.statics.syncDefaults = async function() {
    const services = [
        { name: 'liveDataEnabled', enabled: false }, // Master switch defaults to OFF
        { name: 'iss', enabled: config.api.iss.enabled },
        { name: 'quakes', enabled: config.api.quakes.enabled },
        { name: 'weather', enabled: config.weather.api.enabled }
    ];

    for (const service of services) {
        const existing = await this.findOne({ service: service.name });
        if (!existing) {
            await this.create({
                service: service.name,
                enabled: service.enabled
            });
        }
    }
};

// Use the primary database name from the centralized configuration
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

module.exports = mainDbConnection.model('LiveDataConfig', LiveDataConfigSchema);
