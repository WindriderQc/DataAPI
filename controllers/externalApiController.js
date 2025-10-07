'use strict';

/**
 * @fileoverview Controller for handling requests to external data services.
 * @description This controller provides placeholder endpoints for services like weather, tides, etc.
 * The current implementation returns mock data and is intended for future integration with live data APIs.
 */

const getMockData = (endpointName) => ({
    status: 'success',
    message: `Mock data for ${endpointName}`,
    data: {
        endpoint: endpointName,
        timestamp: new Date(),
        params: {}
    }
});

const createHandler = (endpointName) => (req, res) => {
    // TODO: Replace this mock implementation with a real fetch to the external service.
    const mockData = getMockData(endpointName);
    mockData.data.params = req.query;
    res.json(mockData);
};

module.exports = {
    getWeather: createHandler('weather'),
    getTides: createHandler('tides'),
    getTle: createHandler('tle'),
    getPressure: createHandler('pressure'),
    getEcWeather: createHandler('ec-weather')
};