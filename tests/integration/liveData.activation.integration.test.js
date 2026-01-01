jest.setTimeout(30000);

const liveDatas = require('../../scripts/liveData');
const mqttClient = require('../../scripts/mqttClient');
const fetchUtils = require('../../utils/fetch-utils');
const LiveDataConfig = require('../../models/liveDataConfigModel');
const config = require('../../config/config');

const waitFor = async (predicate, timeout = 3000, interval = 50) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
};

describe('LiveData activation flow', () => {
  let publishMock;
  let fetchMock;
  let intervalSpy;

  beforeEach(async () => {
    intervalSpy = jest.spyOn(global, 'setInterval');
    publishMock = jest.spyOn(mqttClient, 'publish').mockImplementation(() => {});
    fetchMock = jest.spyOn(fetchUtils, 'fetchWithTimeoutAndRetry').mockImplementation(async () => ({
      json: async () => ({
        timestamp: 1759648887,
        iss_position: { latitude: '10.5', longitude: '-20.25' },
        message: 'success',
      }),
    }));

    // Clean DB state for each test
    await db.mainDb.collection('isses').deleteMany({});
    await db.mainDb.collection('quakes').deleteMany({});
    await LiveDataConfig.deleteMany({});
    await LiveDataConfig.create([
      { service: 'iss', enabled: false },
      { service: 'quakes', enabled: false },
      { service: 'weather', enabled: false },
    ]);

    await liveDatas.close();
    await liveDatas.init(db.mainDb);
    await liveDatas.reloadConfig();
  });

  afterEach(async () => {
    intervalSpy?.mockRestore?.();
    fetchMock?.mockRestore?.();
    publishMock?.mockRestore?.();
    await liveDatas.close();
  });

  test('keeps services inactive by default', async () => {
    await liveDatas.setAutoUpdate(true);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();

    const issCount = await db.mainDb.collection('isses').countDocuments();
    const quakesCount = await db.mainDb.collection('quakes').countDocuments();

    expect(issCount).toBe(0);
    expect(quakesCount).toBe(0);
  });

  test('activates ISS updates when enabled, persisting and broadcasting data', async () => {
    // We must ensure the master switch is ON, otherwise updates are ignored
    // or we must update the master switch in the DB.
    // The test setup in beforeEach created { service: 'iss', enabled: false }...
    // But LiveData.init creates 'liveDataEnabled' if missing, defaulting to false.

    // So let's enable both master switch and ISS
    await LiveDataConfig.updateOne({ service: 'liveDataEnabled' }, { $set: { enabled: true } }, { upsert: true });
    await LiveDataConfig.updateOne({ service: 'iss' }, { $set: { enabled: true } });

    await liveDatas.reloadConfig();

    await liveDatas.setAutoUpdate(true);

    const issWritten = await waitFor(async () => {
      const count = await db.mainDb.collection('isses').countDocuments();
      return count > 0;
    });

    expect(issWritten).toBe(true);

    const storedIss = await db.mainDb.collection('isses').findOne({});
    expect(storedIss).toMatchObject({
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });

    expect(publishMock).toHaveBeenCalledWith(
      config.mqtt.issTopic,
      expect.objectContaining({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
    );

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), config.api.iss.interval);
  });
});
