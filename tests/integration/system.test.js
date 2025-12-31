const request = require('supertest');
const express = require('express');
const systemController = require('../../controllers/systemController');

describe('System Controller', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.get('/api/v1/system/resources', systemController.getSystemStats);
    });

    it('should return system stats structure', async () => {
        const res = await request(app).get('/api/v1/system/resources');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('process');
        expect(res.body.data.process).toHaveProperty('cpu');
        expect(res.body.data.process).toHaveProperty('memory');
        expect(res.body.data.process).toHaveProperty('uptime');

        expect(res.body.data).toHaveProperty('system');
        expect(res.body.data.system).toHaveProperty('load_avg');
        expect(res.body.data.system).toHaveProperty('free_mem');
    });
});
