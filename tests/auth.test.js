const request = require('supertest');
const mdb = require('../mongooseDB');
const User = require('../models/userModel');

let app;

beforeAll(async () => {
  await mdb.init();
  app = require('../data_serv');
});

afterAll(async () => {
  await mdb.close();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Auth Flow', () => {
    it('should register a new user and log them in', async () => {
        const res = await request(app)
            .post('/register')
            .send({ name: 'Test User', email: 'test@example.com', password: 'password' })
            .expect(302); // Redirect after registration

        expect(res.header.location).toBe('/users');

        // Check that a session cookie is set
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should log in an existing user', async () => {
        const user = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
        await user.save();

        const res = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect(302);

        expect(res.header.location).toBe('/users');
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should fail to log in with incorrect credentials', async () => {
        const user = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
        await user.save();

        const res = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' })
            .expect(401); // Renders login page with error

        // Check that the response contains the error message
        expect(res.text).toContain('Invalid credentials');
    });

    it('should protect the /users route', async () => {
        const res = await request(app)
            .get('/users')
            .expect(302);

        expect(res.header.location).toBe('/login');
    });

    it('should allow access to the /users route after login', async () => {
        const agent = request.agent(app); // Use agent to persist session
        const user = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
        await user.save();

        await agent
            .post('/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect(302);

        const res = await agent.get('/users').expect(200);
        expect(res.text).toContain('User Management');
    });

    it('should log out a user', async () => {
        const agent = request.agent(app);
        const user = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
        await user.save();

        await agent
            .post('/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect(302);

        const res = await agent.get('/logout').expect(302);
        expect(res.header.location).toBe('/login');

        // Verify that the user is logged out by trying to access a protected route
        await agent.get('/users').expect(302);
    });
});