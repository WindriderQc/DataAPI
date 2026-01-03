const networkScanner = require('../services/networkScanner');
const { createNetworkDeviceModel } = require('../models/networkDevice');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/errors');

// Helper to get the model from the request context
const getModel = (req) => {
    // Assuming mainDb is where we store network data
    const db = req.app.locals.mongoose;
    return createNetworkDeviceModel(db);
};

exports.getAllDevices = catchAsync(async (req, res, next) => {
    const NetworkDevice = getModel(req);
    const devices = await NetworkDevice.find().sort({ lastSeen: -1 });

    res.status(200).json({
        status: 'success',
        results: devices.length,
        data: { devices }
    });
});

exports.scanNetwork = catchAsync(async (req, res, next) => {
    const NetworkDevice = getModel(req);
    const { target, pruneMissing } = req.body;

    // Default to local subnet if not provided
    const scanTarget = target || '192.168.2.0/24';

    try {
        const discoveredDevices = await networkScanner.scanNetwork(scanTarget);

        // Bulk Write / Upsert Logic
        const bulkOps = discoveredDevices.map(device => ({
            updateOne: {
                filter: { mac: device.mac },
                update: {
                    $set: {
                        ip: device.ip,
                        hostname: device.hostname,
                        vendor: device.vendor,
                        status: 'online',
                        lastSeen: new Date()
                    },
                    $setOnInsert: {
                        firstSeen: new Date(),
                        alias: '',
                        notes: ''
                    }
                },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await NetworkDevice.bulkWrite(bulkOps);
        }

        let offlineOps = [];
        // Only mark missing devices as offline if explicitly requested (e.g., full scan)
        // This prevents partial scans (e.g. single IP) from marking everyone else offline.
        if (pruneMissing === true) {
            const allOnline = await NetworkDevice.find({ status: 'online' });
            const discoveredMacs = new Set(discoveredDevices.map(d => d.mac));

            offlineOps = allOnline
                .filter(d => !discoveredMacs.has(d.mac))
                .map(d => ({
                    updateOne: {
                        filter: { mac: d.mac },
                        update: { $set: { status: 'offline' } }
                    }
                }));

            if (offlineOps.length > 0) {
                await NetworkDevice.bulkWrite(offlineOps);
            }
        }

        res.status(200).json({
            status: 'success',
            message: 'Scan completed',
            data: {
                discovered: discoveredDevices.length,
                updated: bulkOps.length,
                markedOffline: offlineOps.length
            }
        });

    } catch (error) {
        return next(new AppError('Scan failed: ' + error.message, 500));
    }
});

exports.updateDevice = catchAsync(async (req, res, next) => {
    const NetworkDevice = getModel(req);
    const { id } = req.params;
    const { alias, notes, type, location } = req.body;

    // Try to find by _id first, then MAC if it's not a valid ObjectId
    let filter = {};
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        filter = { _id: id };
    } else {
        filter = { mac: id };
    }

    const device = await NetworkDevice.findOneAndUpdate(filter, {
        alias,
        notes,
        location,
        'hardware.type': type
    }, { new: true, runValidators: true });

    if (!device) {
        return next(new AppError('No device found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: { device }
    });
});

exports.enrichDevice = catchAsync(async (req, res, next) => {
    const NetworkDevice = getModel(req);
    const { id } = req.params;

    let device;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        device = await NetworkDevice.findById(id);
    } else {
        device = await NetworkDevice.findOne({ mac: id });
    }

    if (!device) return next(new AppError('Device not found', 404));

    if (device.status === 'offline') {
        return next(new AppError('Cannot enrich offline device', 400));
    }

    // Run enrichment
    const details = await networkScanner.enrichDevice(device.ip);

    if (details) {
        if (details.hardware.os) device.hardware.os = details.hardware.os;
        if (details.openPorts) device.openPorts = details.openPorts;
        await device.save();
    }

    res.status(200).json({
        status: 'success',
        data: { device }
    });
});
