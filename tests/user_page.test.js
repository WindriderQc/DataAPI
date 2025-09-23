const request = require('supertest');
const app = require('../data_serv.js'); // Adjust this path if needed
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('User Page', () => {
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('should return 200 OK and render the user management page', async () => {
        const res = await request(app).get('/users');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('User Management');
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
