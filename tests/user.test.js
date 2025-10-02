const request = require('supertest');
const { setup, fullTeardown } = require('./test-setup');
const createUserModel = require('../models/userModel');

describe('User API', () => {
  let app;
  let dbConnection;
  let mongoStore;
  let User;

  beforeAll(async () => {
    const { app: expressApp, dbConnection: conn, mongoStore: store } = await setup();
    app = expressApp;
    dbConnection = conn;
    mongoStore = store;

    // Create the User model using the Mongoose connection from the test setup
    User = createUserModel(dbConnection.mongooseConnection);

    // Inject the test-specific model into the app instance so controllers use it
    app.locals.models = { User };
  }, 30000);

  afterAll(async () => {
    await fullTeardown({ dbConnection, mongoStore });
  });

  afterEach(async () => {
    await User.deleteMany({});
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
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('name', 'Test User');
      expect(res.body.data).toHaveProperty('email', 'test@example.com');

      const dbUser = await User.findOne({ email: 'test@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.name).toBe('Test User');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should return a list of users', async () => {
      await User.create([
        { name: 'Test User 1', email: 'test1@example.com', password: 'password' },
        { name: 'Test User 2', email: 'test2@example.com', password: 'password' }
      ]);

      const res = await request(app).get('/api/v1/users');

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return a single user', async () => {
      const user = await User.create({ name: 'Test User', email: 'test@example.com', password: 'password' });
      const userId = user._id;

      const res = await request(app).get(`/api/v1/users/${userId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('_id', userId.toString());
      expect(res.body.data).toHaveProperty('name', 'Test User');
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update a user', async () => {
      const user = await User.create({ name: 'Test User', email: 'test@example.com', password: 'password' });
      const userId = user._id;
      const updatedData = { name: 'Updated User Name' };

      const res = await request(app)
        .put(`/api/v1/users/${userId}`)
        .send(updatedData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('name', 'Updated User Name');

      const dbUser = await User.findById(userId);
      expect(dbUser.name).toBe('Updated User Name');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete a user', async () => {
      const user = await User.create({ name: 'Test User', email: 'test@example.com', password: 'password' });
      const userId = user._id;

      const res = await request(app).delete(`/api/v1/users/${userId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'User deleted');
      expect(res.body.status).toBe('success');

      const dbUser = await User.findById(userId);
      expect(dbUser).toBeNull();
    });
  });

  describe('User Page', () => {
    it('should redirect to login when accessing the user management page without being authenticated', async () => {
        const res = await request(app).get('/users');
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/login');
    });
  });

  // Failure Scenarios
  describe('Failure Scenarios', () => {
    it('should return 409 when creating a user with a duplicate email', async () => {
      await User.create({ name: 'Test User', email: 'test@example.com', password: 'password' });
      const res = await request(app)
        .post('/api/v1/users')
        .send({ name: 'Another User', email: 'test@example.com', password: 'password' });
      expect(res.statusCode).toEqual(409);
    });

    it('should return 404 when getting a non-existent user', async () => {
      const res = await request(app).get('/api/v1/users/60c72b9a9b1d8e001f8e8b8b');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 404 when updating a non-existent user', async () => {
      const res = await request(app)
        .put('/api/v1/users/60c72b9a9b1d8e001f8e8b8b')
        .send({ name: 'New Name' });
      expect(res.statusCode).toEqual(404);
    });

    it('should return 404 when deleting a non-existent user', async () => {
      const res = await request(app).delete('/api/v1/users/60c72b9a9b1d8e001f8e8b8b');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 when creating a user with missing required fields', async () => {
        const res = await request(app)
            .post('/api/v1/users')
            .send({ name: 'Incomplete User' }); // Missing email and password
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 400 for a malformed user ID in GET', async () => {
        const res = await request(app).get('/api/v1/users/123');
        expect(res.statusCode).toEqual(400);
    });

    it('should return 400 for a malformed user ID in PUT', async () => {
        const res = await request(app).put('/api/v1/users/123').send({ name: 'New Name' });
        expect(res.statusCode).toEqual(400);
    });
  });
});
