const request = require('supertest');

// app and db are global, from test-setup.js

describe('Mew API Endpoints', () => {

    beforeEach(async () => {
        await db.mainDb.collection('mews').deleteMany({});
    });

    describe('GET /api/v1/mew', () => {
        it('should return welcome message', async () => {
            const response = await request(app)
                .get('/api/v1/mew')
                .expect(200);
            
            expect(response.body).toHaveProperty('message', 'Meower!');
        });
    });

    describe('POST /api/v1/mews', () => {
        it('should create a new mew with valid data', async () => {
            const newMew = {
                name: 'Test Cat',
                content: 'This is a test mew!'
            };

            const response = await request(app)
                .post('/api/v1/mews')
                .send(newMew)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body).toHaveProperty('message', 'Mew created successfully');
            expect(response.body.data).toHaveProperty('name', 'Test Cat');
            expect(response.body.data).toHaveProperty('content', 'This is a test mew!');
            expect(response.body.data).toHaveProperty('_id');
            expect(response.body.data).toHaveProperty('created');
        });

        it('should reject mew with missing name', async () => {
            const invalidMew = {
                content: 'Content without name'
            };

            const response = await request(app)
                .post('/api/v1/mews')
                .send(invalidMew)
                .expect(400);

            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should reject mew with missing content', async () => {
            const invalidMew = {
                name: 'Name Only'
            };

            const response = await request(app)
                .post('/api/v1/mews')
                .send(invalidMew)
                .expect(400);

            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should reject mew with name too long', async () => {
            const invalidMew = {
                name: 'a'.repeat(51), // 51 characters
                content: 'Valid content'
            };

            const response = await request(app)
                .post('/api/v1/mews')
                .send(invalidMew)
                .expect(400);

            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should reject mew with content too long', async () => {
            const invalidMew = {
                name: 'Valid Name',
                content: 'a'.repeat(141) // 141 characters
            };

            const response = await request(app)
                .post('/api/v1/mews')
                .send(invalidMew)
                .expect(400);

            expect(response.body).toHaveProperty('status', 'error');
        });
    });

    describe('POST /api/v1/v2/mews', () => {
        it('should create a new mew via v2 endpoint', async () => {
            const newMew = {
                name: 'V2 Cat',
                content: 'This is a v2 mew!'
            };

            const response = await request(app)
                .post('/api/v1/v2/mews')
                .send(newMew)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('name', 'V2 Cat');
        });
    });

    describe('GET /api/v1/mews', () => {
        it('should return all mews as an array', async () => {
             await request(app)
                .post('/api/v1/mews')
                .send({ name: 'Legacy Test', content: 'Legacy content' });
            const response = await request(app)
                .get('/api/v1/mews')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
        });
    });

    describe('GET /api/v1/v2/mews', () => {
        beforeEach(async () => {
            // Create multiple test mews
            for (let i = 0; i < 7; i++) {
                await request(app)
                    .post('/api/v1/mews')
                    .send({ 
                        name: `Test Cat ${i}`, 
                        content: `Test content ${i}` 
                    });
            }
        });

        it('should return paginated mews with metadata', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews')
                .expect(200);

            expect(response.body).toHaveProperty('mews');
            expect(response.body).toHaveProperty('meta');
            expect(Array.isArray(response.body.mews)).toBe(true);
            expect(response.body.meta).toHaveProperty('total');
            expect(response.body.meta).toHaveProperty('skip');
            expect(response.body.meta).toHaveProperty('limit');
            expect(response.body.meta).toHaveProperty('has_more');
        });

        it('should respect skip and limit parameters', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews?skip=2&limit=3')
                .expect(200);

            expect(response.body.mews.length).toBeLessThanOrEqual(3);
            expect(response.body.meta.skip).toBe(2);
            expect(response.body.meta.limit).toBe(3);
        });

        it('should limit max results to 50', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews?limit=100')
                .expect(200);

            expect(response.body.meta.limit).toBe(50);
        });

        it('should enforce minimum limit of 1', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews?limit=0')
                .expect(200);

            expect(response.body.meta.limit).toBe(1);
        });

        it('should sort by desc (newest first) by default', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews?limit=2')
                .expect(200);

            expect(response.body.mews.length).toBeGreaterThan(0);
            // Should have most recent first (highest _id)
        });

        it('should sort by asc when requested', async () => {
            const response = await request(app)
                .get('/api/v1/v2/mews?limit=2&sort=asc')
                .expect(200);

            expect(response.body.mews.length).toBeGreaterThan(0);
            // Should have oldest first (lowest _id)
        });
    });
});