const request = require('supertest');
const { setup, teardown } = require('./test-setup');

describe('Alarm API', () => {
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
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('espID', 'esp123');
  });

  it('should get all alarms with a specific query', async () => {
    await db.collection('alarms').insertOne({ espID: 'esp123', io: '1', enabled: true });

    const res = await request(app)
      .get('/api/v1/alarms?espID=esp123&io=1');

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty('espID', 'esp123');
  });

  it('should return an empty array if alarm is not found', async () => {
    const res = await request(app)
      .get('/api/v1/alarms?espID=nonexistent&io=999');

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(0);
  });
});