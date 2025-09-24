const request = require('supertest');
const mdb = require('../mongooseDB');
const Alarm = require('../models/alarmModel');

let app;

beforeAll(async () => {
  app = await require('../data_serv')();
});

afterAll(async () => {
  await mdb.close();
});

beforeEach(async () => {
  await Alarm.deleteMany({});
});

describe('Alarm API', () => {
  it('should create a new alarm', async () => {
    const res = await request(app)
      .post('/api/v1/alarms')
      .send({
        espID: 'esp123',
        io: 1,
        tStart: new Date(),
        tStop: new Date(),
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.data).toHaveProperty('espID', 'esp123');
  });

  it('should get an alarm by espID and io', async () => {
    const alarm = new Alarm({
      espID: 'esp123',
      io: 1,
      tStart: new Date(),
      tStop: new Date(),
    });
    await alarm.save();

    const res = await request(app)
      .get('/api/v1/alarms/by-esp-io?espID=esp123&io=1');
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toHaveProperty('espID', 'esp123');
    expect(res.body.data).toHaveProperty('io', 1);
  });

  it('should return 400 if espID or io is missing', async () => {
    const res = await request(app)
      .get('/api/v1/alarms/by-esp-io?espID=esp123');
    expect(res.statusCode).toEqual(400);
  });

  it('should return 404 if alarm is not found', async () => {
    const res = await request(app)
      .get('/api/v1/alarms/by-esp-io?espID=nonexistent&io=999');
    expect(res.statusCode).toEqual(404);
  });
});