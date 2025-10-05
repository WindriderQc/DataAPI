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

const { log, logger } = require('./logger');

const ctx = (obj) => {
    // return a short context string to make logs useful without leaking too much
    try {
        if (!obj) return '';
        if (obj._id) return `id=${obj._id}`;
        if (obj.id) return `id=${obj.id}`;
        if (obj.deviceId) return `deviceId=${obj.deviceId}`;
        if (obj.name) return `name=${obj.name}`;
        return '';
    } catch (e) {
        return '';
    }
};

const normalizeCountryData = async (log) => {
    const newLog = { ...log };

    const isMissingName = (v) => {
        if (!v && v !== 0) return true;
        try {
            const s = String(v).trim().toLowerCase();
            if (s.length === 0) return true;
            const placeholders = new Set(['n/a', 'na', 'unknown', 'null', '-', 'none', 'undefined']);
            return placeholders.has(s);
        } catch (e) {
            return true;
        }
    };

    // Normalize existing CountryName if present; but treat placeholder values as missing
    if (Object.prototype.hasOwnProperty.call(newLog, 'CountryName')) {
        try {
            const s = String(newLog.CountryName).trim();
            if (isMissingName(s)) {
                logger.log('info', `[location-normalizer] CountryName treated as missing/placeholder (${ctx(newLog)}): "${String(newLog.CountryName)}"`);
                delete newLog.CountryName;
            } else {
                newLog.CountryName = s;
            }
        } catch (e) {
            logger.log('warn', `[location-normalizer] Error normalizing CountryName (${ctx(newLog)}): ${e && e.message ? e.message : e}`);
            delete newLog.CountryName;
        }
    }

    const keys = Object.keys(newLog);

    const findKey = (candidates) => {
        for (const c of candidates) {
            const found = keys.find(k => k.toLowerCase() === c.toLowerCase());
            if (found) return found;
        }
        return undefined;
    };

    const keyMap = {
        countryName: findKey(['countryname']),
        country: findKey(['country']),
        countryCode: findKey(['countrycode']),
        // support multiple common variants for latitude/longitude
        lat: findKey(['lat', 'latitude', 'y']),
        lon: findKey(['lon', 'lng', 'longitude', 'long', 'x'])
    };

    // Prefer explicit countryName/country fields when they contain meaningful values
    if (keyMap.countryName && !isMissingName(newLog[keyMap.countryName])) {
        const val = String(newLog[keyMap.countryName]).trim();
        newLog.CountryName = val;
        logger.log('info', `[location-normalizer] Inferred CountryName from field "${keyMap.countryName}" (${ctx(newLog)}): "${val}"`);
    } else if (keyMap.country && !isMissingName(newLog[keyMap.country])) {
        const val = String(newLog[keyMap.country]).trim();
        newLog.CountryName = val;
        logger.log('info', `[location-normalizer] Inferred CountryName from field "${keyMap.country}" (${ctx(newLog)}): "${val}"`);
    } else if (keyMap.countryCode && newLog[keyMap.countryCode]) {
        // If a country code exists, map it to a full name when possible.
        try {
            const code = String(newLog[keyMap.countryCode]).toUpperCase().trim();
            if (code.length > 0) {
                const mapped = countryCodeToName[code] || code;
                newLog.CountryName = mapped;
                logger.log('info', `[location-normalizer] Inferred CountryName from countryCode (${ctx(newLog)}): code="${code}" -> "${mapped}"`);
            }
        } catch (e) {
            // ignore and continue to other strategies
        }
    } else if (keyMap.lat && keyMap.lon) {
        let lat = newLog[keyMap.lat];
        let lon = newLog[keyMap.lon];
        // coerce to numbers when possible
        const nLat = Number(lat);
        const nLon = Number(lon);
        const hasNumeric = Number.isFinite(nLat) && Number.isFinite(nLon);
        if (hasNumeric) {
            lat = nLat;
            lon = nLon;
        }

        // If lat looks out of range (>90) but lon is within -90..90, it's likely lat/lon were swapped
        const latOutOfRange = typeof lat === 'number' && (lat < -90 || lat > 90);
        const lonWithinLatRange = typeof lon === 'number' && (lon >= -90 && lon <= 90);
        if (latOutOfRange && lonWithinLatRange) {
            logger.log('info', `[location-normalizer] Detected possible swapped lat/lon fields (${ctx(newLog)}). Swapping values.`);
            const tmp = lat; lat = lon; lon = tmp;
        }

        logger.log('debug', `[location-normalizer] Using lat/lon fields (${ctx(newLog)}): ${keyMap.lat}=${lat}, ${keyMap.lon}=${lon}`);
        try {
            logger.log('info', `[location-normalizer] Attempting reverse geocoding from lat/lon (${ctx(newLog)}): lat=${lat}, lon=${lon}`);
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
                    logger.log('info', `[location-normalizer] Reverse geocoding succeeded (${ctx(newLog)}): "${newLog.CountryName}"`);
                }
            } else {
                 logger.log('warn', `[location-normalizer] LocationIQ API request failed with status: ${response.status} (${ctx(newLog)})`);
            }
        } catch (err) {
            logger.log('warn', `[location-normalizer] Error during reverse geocoding (${ctx(newLog)}): ${err && err.message ? err.message : err}`);
        }
    }

    // Final safety: if CountryName exists but is still a short code (<=3 chars) and we have a countryCode mapping, prefer the mapped full name
    if (newLog.CountryName && newLog.CountryName.length <= 3 && keyMap.countryCode && newLog[keyMap.countryCode]) {
        try {
            const code = String(newLog[keyMap.countryCode]).toUpperCase().trim();
            if (countryCodeToName[code]) newLog.CountryName = countryCodeToName[code];
            logger.log('info', `[location-normalizer] Replaced short CountryName with mapping from countryCode (${ctx(newLog)}): code="${code}" -> "${newLog.CountryName}"`);
        } catch (e) {
            // ignore
        }
    }

    return newLog;
};

module.exports = { normalizeCountryData };