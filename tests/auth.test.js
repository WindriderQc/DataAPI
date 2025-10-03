const request = require('supertest');
const { setup, fullTeardown } = require('./test-setup');
const bcrypt = require('bcrypt');

describe('Auth Flow', () => {
  let app;
  let db;
  let dbConnection;
  let mongoStore;
  let close;

  beforeAll(async () => {
    const { app: expressApp, db: initializedDb, dbConnection: conn, mongoStore: store, close: closeFunc } = await setup();
    app = expressApp;
    db = initializedDb;
    dbConnection = conn;
    mongoStore = store;
    close = closeFunc;
  }, 30000);

  afterAll(async () => {
    await fullTeardown({ dbConnection, mongoStore, close });
  });

  beforeEach(async () => {
    await db.modelDb.collection('users').deleteMany({});
  });

  it('should register a new user and redirect to login', async () => {
    const res = await request(app)
      .post('/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password' });

    expect(res.statusCode).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  it('should log in an existing user', async () => {
    const hashedPassword = await bcrypt.hash('password', 10);
    await db.modelDb.collection('users').insertOne({ name: 'Test User', email: 'test@example.com', password: hashedPassword });

    const res = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(302);

    expect(res.header.location).toBe('/users');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should fail to log in with incorrect credentials', async () => {
    const hashedPassword = await bcrypt.hash('password', 10);
    await db.modelDb.collection('users').insertOne({ name: 'Test User', email: 'test@example.com', password: hashedPassword });

    const res = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.text).toContain('Invalid credentials');
  });

  it('should protect the /users route', async () => {
    const res = await request(app)
      .get('/users')
      .expect(302);
    expect(res.header.location).toBe('/login');
  });

  it('should allow access to the /users route after login', async () => {
    // 1. Setup: Create a user
    const hashedPassword = await bcrypt.hash('password', 10);
    await db.modelDb.collection('users').insertOne({ name: 'Test User', email: 'test@example.com', password: hashedPassword });

    // 2. Login and get the session cookie
    const loginRes = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(302);

    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 3. Make a subsequent request with the cookie
    const res = await request(app)
      .get('/users')
      .set('Cookie', cookies);

    // 4. Assert that the request was successful
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('User Management');
  });

  it('should log out a user', async () => {
    const agent = request.agent(app);
    const hashedPassword = await bcrypt.hash('password', 10);
    await db.modelDb.collection('users').insertOne({ name: 'Test User', email: 'test@example.com', password: hashedPassword });

    await agent
      .post('/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(302);

    const res = await agent.get('/logout').expect(302);
    expect(res.header.location).toBe('/');

    await agent.get('/users').expect(302);
  });
});