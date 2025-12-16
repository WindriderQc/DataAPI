const request = require('supertest');

const TOOL_KEY = process.env.DATAAPI_API_KEY;

describe('New API Endpoints', () => {
    // No beforeAll/afterAll needed, handled by global setup

    beforeEach(async () => {
        // Clean up collections before each test using the global 'db' handle
        await Promise.all([
            db.mainDb.collection('checkins').deleteMany({}),
            db.mainDb.collection('mews').deleteMany({}),
            db.mainDb.collection('userLogs').deleteMany({}),
            db.mainDb.collection('serverLogs').deleteMany({})
        ]);
    });

    describe('GET /geolocation', () => {
        it('should return geolocation data', async () => {
            // 'app' is global
            const res = await request(app)
                .get('/api/v1/geolocation')
                .set('x-api-key', TOOL_KEY);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('country');
        });
    });

    describe('/checkins endpoint', () => {
        it('should create a new check-in', async () => {
            const res = await request(app)
                .post('/api/v1/checkins')
                .set('x-api-key', TOOL_KEY)
                .send({ location: 'Test Location' });
            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.location).toBe('Test Location');
        });

        it('should retrieve all check-ins', async () => {
            await db.mainDb.collection('checkins').insertOne({ location: 'Test Location' });
            const res = await request(app)
                .get('/api/v1/checkins')
                .set('x-api-key', TOOL_KEY);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].location).toBe('Test Location');
        });
    });

    describe('/mews endpoint', () => {
        it('should create a new mew', async () => {
            const res = await request(app)
                .post('/api/v1/mews')
                .set('x-api-key', TOOL_KEY)
                .send({ name: 'test', content: 'Meow!' });
            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.content).toBe('Meow!');
        });

        it('should retrieve all mews', async () => {
            await request(app)
                .post('/api/v1/mews')
                .set('x-api-key', TOOL_KEY)
                .send({ name: 'test', content: 'Meow!' });
            const res = await request(app)
                .get('/api/v1/mews')
                .set('x-api-key', TOOL_KEY);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0].content).toBe('Meow!');
        });
    });

    describe('/logs/server endpoint', () => {
        it('should create a new server log', async () => {
            const res = await request(app)
                .post('/api/v1/logs/server')
                .set('x-api-key', TOOL_KEY)
                .send({ message: 'Server started' });
            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('insertedId');
        });

        it('should retrieve all server logs', async () => {
            await db.mainDb.collection('serverLogs').insertOne({ message: 'Server started' });
            const res = await request(app)
                .get('/api/v1/logs/server')
                .set('x-api-key', TOOL_KEY);
            expect(res.statusCode).toBe(200);
            expect(res.body.logs.length).toBe(1);
            expect(res.body.logs[0].message).toBe('Server started');
        });
    });

    describe('External API endpoints', () => {
        const endpoints = ['weather', 'tides', 'tle', 'pressure', 'ec-weather'];
        endpoints.forEach(endpoint => {
            it(`should return mock data for GET /${endpoint}`, async () => {
                const res = await request(app)
                    .get(`/api/v1/${endpoint}?lat=1&lon=1`)
                    .set('x-api-key', TOOL_KEY);
                expect(res.statusCode).toBe(200);
                expect(res.body.status).toBe('success');
                expect(res.body.message).toBe(`Mock data for ${endpoint}`);
                expect(res.body.data.endpoint).toBe(endpoint);
            });
        });
    });
});