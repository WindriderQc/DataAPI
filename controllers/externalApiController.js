'use strict';

/**
 * @fileoverview Controller for handling requests to external data services.
 * @description This controller provides endpoints for services like weather, tides, etc.
 * It uses external APIs (OpenWeatherMap, Open-Meteo, CelesTrak, MSC GeoMet) to fetch real data.
 */

const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');
const config = require('../config/config');
const { BadRequest, GeneralError } = require('../utils/errors');

// Helper to validate and get lat/lon from query or user profile
// Note: This controller assumes it might be used with or without authentication,
// but if we need to fall back to user location, we need req.user or res.locals.user.
// For now, we'll check req.query first, then try res.locals.user (set by requireAuth).
const getCoordinates = (req, res) => {
    let { lat, lon } = req.query;

    if (!lat || !lon) {
        if (res.locals.user && res.locals.user.lat && res.locals.user.lon) {
            lat = res.locals.user.lat;
            lon = res.locals.user.lon;
        } else {
            // Default to Quebec City if no location provided
            // 46.8138° N, 71.2080° W
            lat = 46.8138;
            lon = -71.2080;
        }
    }

    return { lat, lon };
};

const getWeather = async (req, res, next) => {
    try {
        const { lat, lon } = getCoordinates(req, res);
        const apiKey = config.weather.apiKey;

        if (!apiKey) {
            throw new GeneralError('Weather API key not configured');
        }

        const url = `${config.weather.api.url}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const response = await fetchWithTimeoutAndRetry(url, {
            timeout: config.weather.api.timeout,
            retries: config.weather.api.retries,
            name: 'OpenWeatherMap'
        });

        const data = await response.json();

        res.json({
            status: 'success',
            message: 'Weather data fetched successfully',
            data: data
        });
    } catch (error) {
        next(error);
    }
};

const getPressure = async (req, res, next) => {
    try {
        const { lat, lon } = getCoordinates(req, res);
        const apiKey = config.weather.apiKey;

        if (!apiKey) {
            throw new GeneralError('Weather API key not configured');
        }

        const url = `${config.weather.api.url}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const response = await fetchWithTimeoutAndRetry(url, {
            timeout: config.weather.api.timeout,
            retries: config.weather.api.retries,
            name: 'OpenWeatherMap (Pressure)'
        });

        const data = await response.json();

        res.json({
            status: 'success',
            message: 'Pressure data fetched successfully',
            data: {
                pressure: data.main ? data.main.pressure : null,
                unit: 'hPa',
                timestamp: new Date()
            }
        });
    } catch (error) {
        next(error);
    }
};

const getTides = async (req, res, next) => {
    try {
        const { lat, lon } = getCoordinates(req, res);

        // Open-Meteo Marine API
        // Updated to use wave_height instead of tide_height as tide_height was causing 400 errors
        const url = `${config.tides.api.url}?latitude=${lat}&longitude=${lon}&hourly=wave_height&timezone=auto`;

        const response = await fetchWithTimeoutAndRetry(url, {
            timeout: config.tides.api.timeout,
            retries: config.tides.api.retries,
            name: 'Open-Meteo Marine'
        });

        const data = await response.json();

        res.json({
            status: 'success',
            message: 'Marine data fetched successfully',
            data: data
        });
    } catch (error) {
        next(error);
    }
};

const getTle = async (req, res, next) => {
    try {
        // CelesTrak - Default to Active Satellites or Stations
        // Using Stations (ISS, etc.) as a sensible default
        const url = `${config.tle.api.url}?GROUP=stations&FORMAT=tle`;

        const response = await fetchWithTimeoutAndRetry(url, {
            timeout: config.tle.api.timeout,
            retries: config.tle.api.retries,
            name: 'CelesTrak TLE'
        });

        const textData = await response.text();

        // Simple parsing into lines
        const lines = textData.split('\n').filter(line => line.trim().length > 0);

        res.json({
            status: 'success',
            message: 'TLE data fetched successfully',
            data: {
                source: 'CelesTrak',
                group: 'stations',
                raw: textData,
                count: lines.length / 3, // TLE usually has 3 lines per satellite (Name + 2 lines)
                timestamp: new Date()
            }
        });
    } catch (error) {
        next(error);
    }
};

const getEcWeather = async (req, res, next) => {
    try {
        const { lat, lon } = getCoordinates(req, res);

        // MSC GeoMet API (OGC API Features)
        // Using swob-realtime collection as current-conditions is deprecated or missing.
        // We query with a small bbox around the point to find nearest station.

        const delta = 0.5; // Roughly 50km
        const minLon = parseFloat(lon) - delta;
        const maxLon = parseFloat(lon) + delta;
        const minLat = parseFloat(lat) - delta;
        const maxLat = parseFloat(lat) + delta;

        const url = `${config.ecWeather.api.url}?f=json&bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=1`;

        const response = await fetchWithTimeoutAndRetry(url, {
            timeout: config.ecWeather.api.timeout,
            retries: config.ecWeather.api.retries,
            name: 'MSC GeoMet'
        });

        const data = await response.json();

        res.json({
            status: 'success',
            message: 'EC Weather data fetched successfully',
            data: data
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getWeather,
    getTides,
    getTle,
    getPressure,
    getEcWeather
};
