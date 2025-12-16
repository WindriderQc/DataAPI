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
        json: jest.fn().mockResolvedValue({ message: 'success', iss_position: { latitude: 0, longitude: 0 } }),
        text: jest.fn().mockResolvedValue(''),
    }),
}));

// Mock LiveDataConfig model
const mockLiveDataConfig = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
};
jest.mock('../../models/liveDataConfigModel', () => mockLiveDataConfig);

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

        // Mock DB Find to return empty or disabled by default to test override logic
        mockLiveDataConfig.find.mockResolvedValue([]);
    });

    afterEach(async () => {
        setIntervalSpy.mockRestore();
        await liveData.close();
    });

    it('should not start intervals when all disabled', async () => {
        // We mock find to return disabled config
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: false },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: false }
        ]);

        // Reload config to update internal state
        await liveData.reloadConfig();

        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should start ISS interval when enabled', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: true },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: false }
        ]);

        await liveData.reloadConfig();

        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.api.iss.interval);
    });

    it('should start Quakes interval when enabled', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: false },
            { service: 'quakes', enabled: true },
            { service: 'weather', enabled: false }
        ]);

        await liveData.reloadConfig();

        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.api.quakes.interval);
    });

    it('should start Pressure interval when enabled', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: false },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: true }
        ]);

        await liveData.reloadConfig();

        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), config.weather.api.interval);
    });

    it('should start multiple intervals when multiple enabled', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: true },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: true }
        ]);

        await liveData.reloadConfig();

        await liveData.setAutoUpdate(false);
        expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    });

    it('should not execute getISS when disabled even if called', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: false },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: false }
        ]);

        await liveData.reloadConfig();
        await liveData.setAutoUpdate(true);
        expect(fetchWithTimeoutAndRetry).not.toHaveBeenCalled();
    });

    it('should execute getISS when enabled and called via updateNow', async () => {
        mockLiveDataConfig.find.mockResolvedValue([
            { service: 'iss', enabled: true },
            { service: 'quakes', enabled: false },
            { service: 'weather', enabled: false }
        ]);

        // Mock DB connection for init
        const mockDb = {
            collection: jest.fn().mockReturnValue({
                countDocuments: jest.fn().mockResolvedValue(0),
                insertOne: jest.fn().mockResolvedValue({}),
                findOne: jest.fn().mockResolvedValue(null),
                deleteOne: jest.fn().mockResolvedValue({})
            })
        };

        // Need to stub syncConfig since init calls it
        jest.mock('../../controllers/liveDataConfigController', () => ({
            syncConfig: jest.fn().mockResolvedValue()
        }));

        await liveData.init(mockDb);
        await liveData.reloadConfig();
        await liveData.setAutoUpdate(true);

        expect(fetchWithTimeoutAndRetry).toHaveBeenCalled();
    });
});
