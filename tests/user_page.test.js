const request = require('supertest');
const mdb = require('../mongooseDB');
const User = require('../models/userModel');

let app;

describe('User Page', () => {
    beforeAll(async () => {
        app = await require('../data_serv.js')();
    });

    afterAll(async () => {
        await mdb.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('should redirect to login when accessing the user management page without being authenticated', async () => {
        const res = await request(app).get('/users');
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/login');
    });

    it('should create a new user and return a 201 status code', async () => {
        const res = await request(app)
            .post('/api/v1/users')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(201);

        const user = await User.findOne({ email: 'test@example.com' });
        expect(user).not.toBeNull();
        expect(user.name).toBe('Test User');
    });
});
