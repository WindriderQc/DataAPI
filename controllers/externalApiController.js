'use strict';

/**
 * External API Controller
 * Proxy controller for handling requests to external data services.
 * Implements real data fetching for Weather, Tides, TLE, etc.
 */

const config = require('../config/config');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');
const { BadRequest, GeneralError } = require('../utils/errors');
const querystring = require('querystring');

// Helper to construct URL with query params
const buildUrl = (baseUrl, params) => {
    const query = querystring.stringify(params);
    return `${baseUrl}?${query}`;
};

// Generic proxy handler
const proxyRequest = async (serviceName, url, res, next, transformFn = null) => {
    try {
        const response = await fetchWithTimeoutAndRetry(url, {
            name: serviceName,
            timeout: config.api.defaultFetchTimeout,
            retries: config.api.defaultFetchRetries
        });

        let data = await response.json();

        if (transformFn) {
            data = transformFn(data);
        }

        res.json({
            status: 'success',
            service: serviceName,
            timestamp: new Date(),
            data: data
        });
    } catch (error) {
        // Forward auth errors or 4xx as specific messages, otherwise generic 500
        if (error.status === 401 || error.status === 403) {
            return next(new GeneralError(`External Service Auth Error: ${error.message}`, 502));
        }
        next(error);
    }
};

exports.getWeather = async (req, res, next) => {
    const { lat, lon, city } = req.query;
    const apiKey = config.weather.apiKey;

    if (!config.weather.api.enabled) {
        return res.status(503).json({ status: 'error', message: 'Weather API disabled in config' });
    }

    if (!apiKey) {
        return res.status(500).json({ status: 'error', message: 'Weather API key not configured' });
    }

    // Allow lat/lon or q (city)
    const params = {
        appid: apiKey,
        units: 'metric', // Default to metric
        ...req.query
    };

    if (lat && lon) {
        params.lat = lat;
        params.lon = lon;
    } else if (city) {
        params.q = city;
    }

    // Remove partial internal params if any
    delete params.city;

    const url = buildUrl(config.weather.api.url, params);
    await proxyRequest('OpenWeatherMap', url, res, next);
};

exports.getTides = async (req, res, next) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        // Default to a known location if missing? Or error?
        // Let's error if missing to require explicit coords
        return next(new BadRequest('Missing lat/lon for tides data'));
    }

    const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'wave_height', // Default variable (tide_height not supported in standard marine/free tier often)
        timezone: 'auto',
        ...req.query
    };

    // Remove internal params
    delete params.lat;
    delete params.lon;

    const url = buildUrl(config.tides.api.url, params);
    await proxyRequest('OpenMeteo Tides', url, res, next);
};

exports.getTle = async (req, res, next) => {
    // Proxy for Celestrak
    // Supported params: CATNR, GROUP, INTDES, NAME
    const params = {
        FORMAT: 'json', // Request JSON if supported, or text? Celestrak GP returns TLE or JSON with format=json
        ...req.query
    };

    if (!params.CATNR && !params.GROUP && !params.INTDES && !params.NAME) {
        params.GROUP = 'stations'; // Default to space stations
    }

    const url = buildUrl(config.tle.api.url, params);

    // Custom proxy because Celestrak might return text (TLE standard) unless format=json is strictly supported/respected
    // But we requested JSON above.
    await proxyRequest('Celestrak TLE', url, res, next);
};

exports.getPressure = async (req, res, next) => {
    // Reuse weather API for pressure but filter the result
    const { lat, lon } = req.query;
    const apiKey = config.weather.apiKey;

    if (!apiKey) {
        return res.status(500).json({ status: 'error', message: 'Weather API key not configured (required for pressure)' });
    }

    const params = {
        lat,
        lon,
        appid: apiKey,
        units: 'metric'
    };

    const url = buildUrl(config.weather.api.url, params);

    // Transform to only return pressure
    const transform = (data) => ({
        pressure: data.main ? data.main.pressure : null,
        unit: 'hPa',
        location: data.name
    });

    await proxyRequest('Pressure (OWM)', url, res, next, transform);
};

exports.getEcWeather = async (req, res, next) => {
    // Environment Canada MSC GeoMet API
    // Complex OGC API, usually requires bbox or point
    // We pass through query params
    const params = {
        f: 'json', // force json
        limit: 10,
        ...req.query
    };

    const url = buildUrl(config.ecWeather.api.url, params);
    await proxyRequest('Environment Canada', url, res, next);
};
