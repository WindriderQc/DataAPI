jest.setTimeout(30000);

const { setup, fullTeardown } = require('./test-setup');
const liveDatas = require('../scripts/liveData');
const mqttClient = require('../scripts/mqttClient');
const fetchUtils = require('../utils/fetch-utils');
const config = require('../config/config');

// Helper to wait until a predicate or timeout
const waitFor = async (predicate, timeout = 3000, interval = 50) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
};

describe('LiveData integration (DB write + MQTT publish)', () => {
  let app, db, dbConnection, mongoStore, close;

  beforeAll(async () => {
    const res = await setup();
    app = res.app;
    db = res.db;
    dbConnection = res.dbConnection;
    mongoStore = res.mongoStore;
    close = res.close;

    // stub mqtt publish
    mqttClient.publish = jest.fn();

    // stub fetchWithTimeoutAndRetry
    jest.spyOn(fetchUtils, 'fetchWithTimeoutAndRetry').mockImplementation(async (url) => {
      if (url && url.includes('iss')) {
        return {
          ok: true,
          json: async () => ({ latitude: 10.123, longitude: -20.456 }),
        };
      }
      // quakes CSV: simple header + one row
      return {
        ok: true,
        text: async () => 'latitude,longitude\n11.11,22.22',
      };
    });

    // Initialize liveDatas with the test DB handle
    await liveDatas.init(db.mainDb);
  });

  afterAll(async () => {
    // cleanup intervals and mqtt
    try { await liveDatas.close(); } catch (e) {}
    jest.restoreAllMocks();
    await fullTeardown({ dbConnection, mongoStore, close });
  });

  test('writes ISS and Quake data to DB and publishes ISS over MQTT', async () => {
    // Trigger immediate update
    await liveDatas.setAutoUpdate(true);

    // Wait for iss write
    const issOk = await waitFor(async () => {
      const count = await db.mainDb.collection('isses').countDocuments();
      return count > 0;
    }, 3000);

    expect(issOk).toBeTruthy();

    // Wait for quakes write
    const quakesOk = await waitFor(async () => {
      const count = await db.mainDb.collection('quakes').countDocuments();
      return count > 0;
    }, 3000);

    expect(quakesOk).toBeTruthy();

    // MQTT publish should have been called at least once for ISS
    expect(mqttClient.publish).toHaveBeenCalled();
    const [topic, payload] = mqttClient.publish.mock.calls[0];
    expect(topic).toBe(config.mqtt.issTopic);
    // payload should be JSON-serializable or an object
    expect(payload).toHaveProperty('latitude');
    expect(payload).toHaveProperty('longitude');
  });
});
