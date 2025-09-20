const request = require('supertest');
const app = require('../data_serv.js');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('User Routes', () => {
    let mongoServer;

    // Connect to a test database before all tests
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    });

    // Disconnect from the database after all tests
    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    // Clear the User collection after each test
    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('POST /users', () => {
        it('should create a new user successfully and hash the password', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            const res = await request(app)
                .post('/users')
                .send(userData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'New user created!');
            expect(res.body.data).toHaveProperty('name', 'Test User');
            expect(res.body.data).toHaveProperty('email', 'test@example.com');
            // The password should NOT be returned in the response
            expect(res.body.data).not.toHaveProperty('password');

            // Verify the user was created in the DB and password was hashed
            const dbUser = await User.findOne({ email: 'test@example.com' });
            expect(dbUser).not.toBeNull();
            expect(dbUser.password).not.toEqual('password123');

            // Verify the comparePassword method works
            const isMatch = await dbUser.comparePassword('password123');
            expect(isMatch).toBe(true);
            const isNotMatch = await dbUser.comparePassword('wrongpassword');
            expect(isNotMatch).toBe(false);
        });

        it('should fail to create a user with invalid data', async () => {
            const userData = {
                name: 'Test User',
                // email is missing
                password: 'password123'
            };

            const res = await request(app)
                .post('/users')
                .send(userData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('errors');
            const emailError = res.body.errors.find(e => e.path === 'email');
            expect(emailError).toBeDefined();
            expect(emailError.msg).toEqual('Please provide a valid email address.');
        });
    });
});
