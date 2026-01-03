const request = require('supertest');

const TOOL_KEY = process.env.DATAAPI_API_KEY;

describe('Alerts API', () => {
  beforeEach(async () => {
    await db.mainDb.collection('alerts').deleteMany({});
    await db.mainDb.collection('alert').deleteMany({});
    await db.mainDb.collection('Alert').deleteMany({});
  });

  it('should create an alert with default source and mapped severity', async () => {
    const res = await request(app)
      .post('/api/v1/alerts')
      .set('x-api-key', TOOL_KEY)
      .send({
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 'error',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data).toHaveProperty('severity', 'critical');
    expect(res.body.data).toHaveProperty('source', 'system');
    expect(res.body.data).toHaveProperty('status', 'active');
  });

  it('should list alerts with severity filtering (error maps to critical)', async () => {
    await db.mainDb.collection('alerts').insertMany([
      { title: 'A', message: 'm1', severity: 'critical', status: 'active', source: 'system', createdAt: new Date(), updatedAt: new Date() },
      { title: 'B', message: 'm2', severity: 'warning', status: 'active', source: 'system', createdAt: new Date(), updatedAt: new Date() }
    ]);

    const res = await request(app)
      .get('/api/v1/alerts?severity=error')
      .set('x-api-key', TOOL_KEY);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('severity', 'critical');
  });

  it('should update alert status to resolved and set resolvedAt', async () => {
    const insert = await db.mainDb.collection('alerts').insertOne({
      title: 'Resolve Me',
      message: 'm',
      severity: 'info',
      status: 'active',
      source: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
    });

    const res = await request(app)
      .patch(`/api/v1/alerts/${insert.insertedId.toString()}/status`)
      .set('x-api-key', TOOL_KEY)
      .send({ status: 'resolved' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('status', 'resolved');
    expect(res.body.data).toHaveProperty('resolvedAt');
    expect(res.body.data.resolvedAt).toBeTruthy();
  });
});
