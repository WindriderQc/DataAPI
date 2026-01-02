const networkScanner = require('../services/networkScanner');
const { createNetworkDeviceModel } = require('../models/networkDevice');
const catchAsync = require('../utils/catchAsync');
const { NotFoundError, BadRequest } = require('../utils/errors');
const { validationResult } = require('express-validator');

// Helper to get the model from the request context
const getModel = (req) => {
    // Assuming mainDb is where we store network data
    const db = req.app.locals.dbs.mainDb;
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

    // Validate CIDR notation or IP address
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const scanTarget = target || '192.168.1.0/24';
    
    if (!cidrRegex.test(scanTarget)) {
        return next(new BadRequest('Invalid CIDR notation or IP address'));
    }

    // Validate CIDR components
    const parts = scanTarget.split('/');
    const ipParts = parts[0].split('.');
    if (ipParts.some(part => parseInt(part) > 255 || parseInt(part) < 0)) {
        return next(new BadRequest('Invalid IP address range'));
    }
    if (parts[1] && (parseInt(parts[1]) > 32 || parseInt(parts[1]) < 0)) {
        return next(new BadRequest('Invalid CIDR prefix'));
    }

    try {
        const discoveredDevices = await networkScanner.scanNetwork(scanTarget);

        // Build a lookup of existing devices by MAC so we can track IP history
        const macs = discoveredDevices.map(d => d.mac);
        const existingDevices = await NetworkDevice.find(
            { mac: { $in: macs } },
            { mac: 1, ip: 1 }
        );
        const existingByMac = new Map(
            existingDevices.map(doc => [doc.mac, doc])
        );

        // Bulk Write / Upsert Logic
        const bulkOps = discoveredDevices.map(device => {
            const existing = existingByMac.get(device.mac);

            const update = {
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
            };

            // If the device already exists and the IP has changed, push the old IP to ipHistory
            if (
                existing &&
                existing.ip &&
                existing.ip !== device.ip
            ) {
                update.$push = { ipHistory: existing.ip };
            }

            return {
                updateOne: {
                    filter: { mac: device.mac },
                    update,
                    upsert: true
                }
            };
        });

        if (bulkOps.length > 0) {
            await NetworkDevice.bulkWrite(bulkOps);
        }

        let offlineOps = [];
        // Only mark missing devices as offline if explicitly requested (e.g., full scan)
        // This prevents partial scans (e.g. single IP) from marking everyone else offline.
        if (pruneMissing === true) {
            const discoveredMacs = discoveredDevices.map(d => d.mac);
            
            // Use a single bulk update operation to mark all devices not in the discovered list as offline
            const result = await NetworkDevice.updateMany(
                { 
                    status: 'online',
                    mac: { $nin: discoveredMacs }
                },
                { 
                    $set: { status: 'offline' } 
                }
            );

            offlineOps = [{ modifiedCount: result.modifiedCount }];
        }

        res.status(200).json({
            status: 'success',
            message: 'Scan completed',
            data: {
                discovered: discoveredDevices.length,
                updated: bulkOps.length,
                markedOffline: offlineOps.length > 0 ? offlineOps[0].modifiedCount : 0
            }
        });

    } catch (error) {
        return next(new BadRequest('Scan failed: ' + error.message));
    }
});

exports.updateDevice = catchAsync(async (req, res, next) => {
    const NetworkDevice = getModel(req);
    const { id } = req.params;
    const { alias, notes, type, location } = req.body;

    // Validate input lengths
    if (alias && alias.length > 100) {
        return next(new BadRequest('Alias must be 100 characters or less'));
    }
    if (notes && notes.length > 1000) {
        return next(new BadRequest('Notes must be 1000 characters or less'));
    }
    if (location && location.length > 200) {
        return next(new BadRequest('Location must be 200 characters or less'));
    }
    if (type && !['unknown', 'workstation', 'server', 'mobile', 'iot', 'network'].includes(type)) {
        return next(new BadRequest('Invalid device type'));
    }

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
        return next(new NotFoundError('No device found with that ID'));
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

    if (!device) return next(new NotFoundError('Device not found'));

    if (device.status === 'offline') {
        return next(new BadRequest('Cannot enrich offline device'));
    }

    // Validate IP address format
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
    
    if (!ipv4Regex.test(device.ip) && !ipv6Regex.test(device.ip)) {
        return next(new BadRequest('Invalid IP address format'));
    }

    // Run enrichment
    const details = await networkScanner.enrichDevice(device.ip);

    if (details) {
        if (details.hardware && details.hardware.os) {
            if (!device.hardware) device.hardware = {};
            device.hardware.os = details.hardware.os;
        }
        if (details.openPorts) device.openPorts = details.openPorts;
        await device.save();
    }

    res.status(200).json({
        status: 'success',
        data: { device }
    });
});
