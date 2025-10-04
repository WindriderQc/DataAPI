'use strict';

const countryCodeToName = {
    "US": "United States of America",
    "CA": "Canada",
    "GB": "United Kingdom",
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

    // If CountryName already exists, no need to do anything.
    if (newLog.CountryName) {
        return newLog;
    }

    // Find a key that matches 'countryname', 'country', or 'countrycode' case-insensitively
    const keys = Object.keys(newLog);
    const countryNameKey = keys.find(k => k.toLowerCase() === 'countryname');
    const countryKey = keys.find(k => k.toLowerCase() === 'country');
    const countryCodeKey = keys.find(k => k.toLowerCase() === 'countrycode');

    let countryValue;
    if (countryNameKey) {
        countryValue = newLog[countryNameKey];
    } else if (countryKey) {
        countryValue = newLog[countryKey];
    } else if (countryCodeKey) {
        const code = newLog[countryCodeKey].toUpperCase();
        countryValue = countryCodeToName[code] || newLog[countryCodeKey];
    }

    if (countryValue) {
        newLog.CountryName = countryValue;
        return newLog; // Return early if we found a text-based country
    }

    // If no country name was found, try geocoding with lat/lon
    const latKey = keys.find(k => k.toLowerCase() === 'lat');
    const lonKey = keys.find(k => k.toLowerCase() === 'lon');

    if (latKey && lonKey) {
        const lat = newLog[latKey];
        const lon = newLog[lonKey];
        try {
            const apiKey = process.env.LOCATION_IQ_API;
            if (!apiKey) {
                console.error("LOCATION_IQ_API key is missing from environment variables.");
                return newLog;
            }
            const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lon}&format=json`;
            const response = await fetch(url);
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