const request = require('supertest');
const { setup, fullTeardown } = require('./test-setup');

describe('Alarm API', () => {
  let app;
  let db;
  let closeHttpServer;
  let dbConnection;

  beforeAll(async () => {
    const { app: expressApp, db: initializedDb, closeHttpServer: serverCloser, dbConnection: conn } = await setup();
    app = expressApp;
    db = initializedDb;
    closeHttpServer = serverCloser;
    dbConnection = conn;
  });

  afterAll(async () => {
    await fullTeardown({ closeHttpServer, dbConnection });
  });

  beforeEach(async () => {
    await db.collection('alarms').deleteMany({});
  });

  it('should create a new alarm', async () => {
    const res = await request(app)
      .post('/api/v1/alarms')
      .send({
        espID: 'esp123',
        io: '1',
        enabled: true
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data).toHaveProperty('espID', 'esp123');
  });

  it('should get all alarms with a specific query', async () => {
    await db.collection('alarms').insertOne({ espID: 'esp123', io: '1', enabled: true });

    const res = await request(app)
      .get('/api/v1/alarms?espID=esp123&io=1');

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('espID', 'esp123');
  });

  it('should return an empty array if alarm is not found', async () => {
    const res = await request(app)
      .get('/api/v1/alarms?espID=nonexistent&io=999');

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBe(0);
  });
});