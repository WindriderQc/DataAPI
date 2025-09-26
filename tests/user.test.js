const request = require('supertest');
const { setup, teardown } = require('./test-setup');

describe('User API', () => {
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

  afterEach(async () => {
    await db.collection('users').deleteMany({});
  });

  describe('POST /api/v1/users', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/v1/users')
        .send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body).toHaveProperty('name', 'Test User');
      expect(res.body).toHaveProperty('email', 'test@example.com');

      // Verify the user was created in the DB
      const dbUser = await db.collection('users').findOne({ email: 'test@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.name).toBe('Test User');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should return a list of users', async () => {
        await db.collection('users').insertOne({ name: 'Test User 1', email: 'test1@example.com' });
        await db.collection('users').insertOne({ name: 'Test User 2', email: 'test2@example.com' });

        const res = await request(app).get('/api/v1/users');

        expect(res.statusCode).toEqual(200);
        expect(res.body.length).toBe(2);
    });
  });
});
