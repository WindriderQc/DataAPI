'use strict';

const countryCodeToName = {
    "US": "United States of America", "USA": "United States of America",
    "CA": "Canada",
    "GB": "United Kingdom", "UK": "United Kingdom",
    "AU": "Australia",
    "DE": "Germany",
    "FR": "France",
    "JP": "Japan",
    "IN": "India",
    "CN": "China",
    "BR": "Brazil",
    "RU": "Russian Federation",
    "ZA": "South Africa"
};

const normalizeCountryData = async (log) => {
    const newLog = { ...log };

    // If a CountryName exists, normalize it (trim). If after trimming it's empty, continue
    if (newLog.CountryName) {
        try {
            const s = String(newLog.CountryName).trim();
            if (s.length > 0) {
                newLog.CountryName = s;
                return newLog;
            }
            // empty after trim -> treat as missing and continue normalization
            delete newLog.CountryName;
        } catch (e) {
            // if conversion fails, continue to other normalization paths
        }
    }

    const keys = Object.keys(newLog);
    const keyMap = {
        countryName: keys.find(k => k.toLowerCase() === 'countryname'),
        country: keys.find(k => k.toLowerCase() === 'country'),
        countryCode: keys.find(k => k.toLowerCase() === 'countrycode'),
        lat: keys.find(k => k.toLowerCase() === 'lat'),
        lon: keys.find(k => k.toLowerCase() === 'lon')
    };

    if (keyMap.countryName) {
        newLog.CountryName = newLog[keyMap.countryName];
    } else if (keyMap.country) {
        newLog.CountryName = newLog[keyMap.country];
    } else if (keyMap.countryCode) {
        const code = newLog[keyMap.countryCode].toUpperCase();
        newLog.CountryName = countryCodeToName[code] || newLog[keyMap.countryCode];
    } else if (keyMap.lat && keyMap.lon) {
        const lat = newLog[keyMap.lat];
        const lon = newLog[keyMap.lon];
        try {
            const apiKey = process.env.LOCATION_IQ_API;
            if (!apiKey) {
                console.error("LOCATION_IQ_API key is missing from environment variables.");
                return newLog;
            }
            const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lon}&format=json`;
            const { fetchWithTimeoutAndRetry } = require('./fetch-utils');
            const config = require('../config/config');
            const response = await fetchWithTimeoutAndRetry(url, { timeout: config.api.defaultFetchTimeout, retries: config.api.defaultFetchRetries, name: 'LocationIQ' });
            if (response.ok) {
                const data = await response.json();
                if (data.address && data.address.country) {
                    newLog.CountryName = data.address.country;
                }
            } else {
                 console.error(`LocationIQ API request failed with status: ${response.status}`);
            }
        } catch (err) {
            console.error('Error during reverse geocoding:', err);
        }
    }

    return newLog;
};

module.exports = { normalizeCountryData };