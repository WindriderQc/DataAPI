// Mocks must be defined before use
jest.mock('../../scripts/mqttClient', () => ({
    init: jest.fn(),
    publish: jest.fn(),
    close: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
    log: jest.fn(),
}));

jest.mock('../../utils/fetch-utils', () => ({
    fetchWithTimeoutAndRetry: jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue(''),
    }),
}));

describe('LiveData Configuration', () => {
    let liveData;
    let config;
    let setIntervalSpy;
    let fetchWithTimeoutAndRetry;

    beforeEach(() => {
        jest.resetModules();

        // Re-require modules to get fresh instances and apply mocks
        config = require('../../config/config');
        liveData = require('../../scripts/liveData');
        fetchWithTimeoutAndRetry = require('../../utils/fetch-utils').fetchWithTimeoutAndRetry;

        setIntervalSpy = jest.spyOn(global, 'setInterval');

        // Reset enabled state to false (default)
        config.api.iss.enabled = false;
        config.api.quakes.enabled = false;
        config.weather.api.enabled = false;
    });

    afterEach(async () => {
        setIntervalSpy.mockRestore();
        await liveData.close();
    });

    it('should not start intervals when all disabled', async () => {
        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should start ISS interval when enabled', async () => {
        config.api.iss.enabled = true;
        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.api.iss.interval);
    });

     it('should start Quakes interval when enabled', async () => {
        config.api.quakes.enabled = true;
        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.api.quakes.interval);
    });

     it('should start Pressure interval when enabled', async () => {
        config.weather.api.enabled = true;
        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.weather.api.interval);
    });

    it('should start multiple intervals when multiple enabled', async () => {
        config.api.iss.enabled = true;
        config.weather.api.enabled = true;
        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    });

    it('should not execute getISS when disabled even if called', async () => {
        config.api.iss.enabled = false;
        await liveData.setAutoUpdate(true);
        expect(fetchWithTimeoutAndRetry).not.toHaveBeenCalled();
    });

    it('should execute getISS when enabled and called via updateNow', async () => {
        config.api.iss.enabled = true;

        const mockDb = { collection: jest.fn() };
        liveData.init(mockDb);

        await liveData.setAutoUpdate(true);

        expect(fetchWithTimeoutAndRetry).toHaveBeenCalled();
    });
});
