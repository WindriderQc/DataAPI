const request = require('supertest');
const { setup, teardown } = require('./test-setup');

describe('User Page', () => {
    let app;
    let db;

    beforeAll(async () => {
        const { app: expressApp, db: initializedDb } = await setup();
        app = expressApp;
        db = initializedDb;
    });

    afterAll(async () => {
        await teardown();
    });

    beforeEach(async () => {
        await db.collection('users').deleteMany({});
    });

    it('should redirect to login when accessing the user management page without being authenticated', async () => {
        const res = await request(app).get('/users');
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/login');
    });

    it('should create a new user via API and return a 201 status code', async () => {
        const res = await request(app)
            .post('/api/v1/users')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('_id');
        expect(res.body).toHaveProperty('name', 'Test User');

        const user = await db.collection('users').findOne({ email: 'test@example.com' });
        expect(user).not.toBeNull();
        expect(user.name).toBe('Test User');
    });
});
