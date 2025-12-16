const request = require('supertest');

const TOOL_KEY = process.env.DATAAPI_API_KEY;

describe('Alarm API', () => {
  beforeEach(async () => {
    // The 'db' object is now available globally thanks to the setup file
    await db.mainDb.collection('alarms').deleteMany({});
  });

  it('should create a new alarm', async () => {
    // The 'app' object is now available globally
    const res = await request(app)
      .post('/api/v1/alarms')
      .set('x-api-key', TOOL_KEY)
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
    // The 'db' object is now available globally
    await db.mainDb.collection('alarms').insertOne({ espID: 'esp123', io: '1', enabled: true });

    // The 'app' object is now available globally
    const res = await request(app)
      .get('/api/v1/alarms?espID=esp123&io=1')
      .set('x-api-key', TOOL_KEY);

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('espID', 'esp123');
  });

  it('should return an empty array if alarm is not found', async () => {
    // The 'app' object is now available globally
    const res = await request(app)
      .get('/api/v1/alarms?espID=nonexistent&io=999')
      .set('x-api-key', TOOL_KEY);

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBe(0);
  });
});