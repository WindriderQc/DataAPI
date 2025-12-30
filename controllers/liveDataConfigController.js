const LiveDataConfig = require('../models/liveDataConfigModel');
const liveDatas = require('../scripts/liveData');

/**
 * Ensures database has configuration for all services.
 * Now delegated to the Model's static method.
 */
exports.syncConfig = async () => {
    await LiveDataConfig.syncDefaults();
};

/**
 * Gets the current configuration for all services.
 */
exports.getConfigs = async (req, res) => {
    try {
        const configs = await LiveDataConfig.find({});
        // Convert to a simple object { iss: true, quakes: false, ... }
        const result = configs.reduce((acc, curr) => {
            acc[curr.service] = curr.enabled;
            return acc;
        }, {});
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Updates the configuration for a specific service.
 */
exports.updateConfig = async (req, res) => {
    const { service, enabled } = req.body;

    if (!['liveDataEnabled', 'iss', 'quakes', 'weather'].includes(service)) {
        return res.status(400).json({ status: 'error', message: 'Invalid service name' });
    }

    try {
        const updated = await LiveDataConfig.findOneAndUpdate(
            { service },
            { enabled, updatedAt: new Date() },
            { new: true, upsert: true }
        );

        // Notify liveData script to update its internal state
        await liveDatas.reloadConfig();

        res.json({ status: 'success', data: updated });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
