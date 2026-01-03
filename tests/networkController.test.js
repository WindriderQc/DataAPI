const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const { createNetworkDeviceModel } = require('../models/networkDevice');
const networkController = require('../controllers/networkController');

// Mock dependencies
jest.mock('../services/networkScanner', () => ({
    scanNetwork: jest.fn(),
    enrichDevice: jest.fn()
}));

const networkScanner = require('../services/networkScanner');

describe('Network Controller', () => {
    let app;
    let connection;

    beforeAll(async () => {
        // Use the shared MongoMemoryServer started by Jest globalSetup.
        // Isolate this suite by using a unique dbName.
        const mongoUri = process.env.MONGO_URL;
        if (!mongoUri) {
            throw new Error('MONGO_URL is not set. Ensure Jest globalSetup is configured.');
        }

        connection = await mongoose
            .createConnection(mongoUri, {
                dbName: `network_test_${process.env.JEST_WORKER_ID || '0'}`
            })
            .asPromise();

        app = express();
        app.use(express.json());

        // Mock app.locals structure
        app.locals = {
            mongoose: connection,
            dbs: {
                mainDb: connection
            }
        };

        // Mount routes
        app.get('/api/v1/network/devices', networkController.getAllDevices);
        app.post('/api/v1/network/scan', networkController.scanNetwork);
    });

    afterAll(async () => {
        await connection.close();
    });

    beforeEach(async () => {
        const NetworkDevice = createNetworkDeviceModel(connection);
        await NetworkDevice.deleteMany({});
        jest.clearAllMocks();
    });

    it('should return empty list initially', async () => {
        const res = await request(app).get('/api/v1/network/devices');
        expect(res.status).toBe(200);
        expect(res.body.data.devices).toEqual([]);
    });

    it('should scan and add devices', async () => {
        // Mock scanner result
        networkScanner.scanNetwork.mockResolvedValue([
            { mac: 'AA:BB:CC:DD:EE:FF', ip: '192.168.1.10', hostname: 'test-host', vendor: 'Test', status: 'online' }
        ]);

        const res = await request(app)
            .post('/api/v1/network/scan')
            .send({ target: '192.168.1.0/24' });

        expect(res.status).toBe(200);
        expect(res.body.data.discovered).toBe(1);

        // Verify DB
        const NetworkDevice = createNetworkDeviceModel(connection);
        const devices = await NetworkDevice.find();
        expect(devices.length).toBe(1);
        expect(devices[0].mac).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should not mark missing devices offline if pruneMissing is false', async () => {
        const NetworkDevice = createNetworkDeviceModel(connection);
        await NetworkDevice.create({
            mac: '11:22:33:44:55:66',
            ip: '192.168.1.5',
            status: 'online'
        });

        // Scan finds nothing
        networkScanner.scanNetwork.mockResolvedValue([]);

        await request(app)
            .post('/api/v1/network/scan')
            .send({ target: '192.168.1.100', pruneMissing: false });

        const device = await NetworkDevice.findOne({ mac: '11:22:33:44:55:66' });
        expect(device.status).toBe('online');
    });

    it('should mark missing devices offline if pruneMissing is true', async () => {
        const NetworkDevice = createNetworkDeviceModel(connection);
        await NetworkDevice.create({
            mac: '11:22:33:44:55:66',
            ip: '192.168.1.5',
            status: 'online'
        });

        // Scan finds nothing
        networkScanner.scanNetwork.mockResolvedValue([]);

        await request(app)
            .post('/api/v1/network/scan')
            .send({ target: '192.168.1.0/24', pruneMissing: true });

        const device = await NetworkDevice.findOne({ mac: '11:22:33:44:55:66' });
        expect(device.status).toBe('offline');
    });

    it('should not crash on repeated requests (Model Factory Check)', async () => {
        await request(app).get('/api/v1/network/devices');
        const res = await request(app).get('/api/v1/network/devices');
        expect(res.status).toBe(200);
    });
});
