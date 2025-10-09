jest.setTimeout(30000);

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
  // No app/db/close variables needed, they are global now.

  beforeAll(async () => {
    // The global setup has already initialized app and db.
    // We just need to set up mocks specific to this test suite.

    // stub mqtt publish
    mqttClient.publish = jest.fn();

    // stub fetchWithTimeoutAndRetry
    jest.spyOn(fetchUtils, 'fetchWithTimeoutAndRetry').mockImplementation(async (url) => {
      if (url && url.includes('iss')) {
        return {
          ok: true,
          json: async () => ({
            timestamp: 1759648887,
            iss_position: { latitude: '8.7368', longitude: '3.6946' },
            message: 'success'
          }),
        };
      }
      // quakes CSV: simple header + one row
      return {
        ok: true,
        text: async () => 'latitude,longitude\n11.11,22.22',
      };
    });

    // Initialize liveDatas with the global test DB handle
    await liveDatas.init(db.mainDb);
  });

  afterAll(async () => {
    // Cleanup intervals, mqtt, and restore mocks.
    // The global afterAll will handle closing the db connection.
    try { await liveDatas.close(); } catch (e) {}
    jest.restoreAllMocks();
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