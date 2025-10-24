const fs = require('fs');
const CSVToJSON = require('csvtojson');
const mqttClient = require('./mqttClient.js');
const config = require('../config/config');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');
const { log } = require('../utils/logger');

let mainDb; // The active database connection

let dataStore = { version: 1.0 };
const version = dataStore.version;
let intervalIds = [];
let initialized = false; // guard to prevent double initialization

// use shared fetchWithTimeoutAndRetry from utils/fetch-utils.js

async function getISS() {
    if (!mainDb) {
        log('[liveData] getISS: Database not initialized.', 'error');
        return;
    }
    const issCollection = mainDb.collection('isses');

    try {
        const response = await fetchWithTimeoutAndRetry(config.api.iss.url, { timeout: config.api.iss.timeout, retries: config.api.iss.retries, name: 'ISS API' });
        const data = await response.json();
        //console.log(data);
        if (data.message !== 'success') { return; }

    // Keep the simple shape but normalize types and reject null/empty values:
    // latitude/longitude -> Number, timeStamp -> Date
    const latRaw = data.iss_position && (data.iss_position.latitude ?? data.iss_position.lat);
    const lonRaw = data.iss_position && (data.iss_position.longitude ?? data.iss_position.lon);

    const latitude = (latRaw === null || latRaw === undefined || String(latRaw).trim() === '') ? null : Number(latRaw);
    const longitude = (lonRaw === null || lonRaw === undefined || String(lonRaw).trim() === '') ? null : Number(lonRaw);

        // Convert timestamp (likely seconds) to Date. If timestamp looks like ms already, use it.
        let timeStamp;
        if (data.timestamp !== undefined) {
            const tsNum = Number(data.timestamp);
            timeStamp = tsNum > 1e12 ? new Date(tsNum) : new Date(tsNum * 1000);
        } else {
            timeStamp = new Date();
        }

        // Reject null/NaN/Infinite coordinates
        if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            log('[liveData] Invalid ISS coordinates received; skipping write/publish. rawPayload=' + JSON.stringify(data), 'warn');
            return;
        }

        const newIssData = { latitude, longitude, timeStamp };
        dataStore.iss = newIssData;
        mqttClient.publish(config.mqtt.issTopic, newIssData);

        const countBefore = await issCollection.countDocuments();

        if (countBefore >= config.api.iss.maxLogs) {
            const oldestDoc = await issCollection.findOne({}, { sort: { timeStamp: 1 } });
            if (oldestDoc) {
                await issCollection.deleteOne({ _id: oldestDoc._id });
            }
        }

        await issCollection.insertOne(newIssData);
    } catch (error) {
        log(`Error getting ISS location: ${error.message}`, 'error');
    }
}

async function getQuakes() {
    if (!mainDb) {
        log('[liveData] getQuakes: Database not initialized.', 'error');
        return;
    }
    const quakesCollection = mainDb.collection('quakes');

    try {
        const response = await fetchWithTimeoutAndRetry(config.api.quakes.url, { timeout: config.api.quakes.timeout, retries: config.api.quakes.retries, name: 'Quakes API' });
        const data = await response.text();
        fs.writeFileSync(config.api.quakes.path, data);
        const quakes = await CSVToJSON().fromString(data);

        log('Flushing the Quake collection...');
        await quakesCollection.deleteMany({});
        log('Quake collection flushed.');

        if (quakes.length > 0) {
            await quakesCollection.insertMany(quakes, { ordered: false }).catch(err => {
                if (err.code !== 11000) { // Ignore duplicate key errors
                    log(`Error saving Quake locations to database: ${err}`, 'error');
                }
            });
        }
    } catch (error) {
        log(`Error getting quakes: ${error.message}`, 'error');
    }
}

function init(dbConnection) {
    if (initialized) {
        log('LiveData.init called but already initialized; ignoring duplicate call.', 'warn');
        return;
    }

    // dbConnection should be the active DB handle
    mainDb = dbConnection;

    log(`LiveData initializing at ${new Date().toISOString()}`);

    if (!fs.existsSync(config.api.quakes.path)) {
        log(`No Earthquakes data file found. Will request from API now and update daily: ${config.api.quakes.path}`);
    } else {
        log('quakes file found');
    }

    mqttClient.init();

    // Do not run intervals in the test environment
    if (config.env !== 'test') {
        setAutoUpdate(true);
    }

    initialized = true;
}

async function setAutoUpdate(updateNow = false) {
    const intervals = {
        quakes: config.api.quakes.interval,
        iss: config.api.iss.interval,
        pressure: config.weather.api.interval,
    };

    if (updateNow) {
        await Promise.all([getQuakes(), getISS(), getPressure()]);
    }

    intervalIds.push(setInterval(getQuakes, intervals.quakes));  //  quakes is actualized rarely, saving to mongodb
    intervalIds.push(setInterval(getISS, intervals.iss));   //  iss is actualized frequently, broadcasting to mqtt
    intervalIds.push(setInterval(getPressure, intervals.pressure));

    log(`LiveData configured - Intervals: ${JSON.stringify(intervals)}`);
}

async function getPressure() {
    if (!mainDb) {
        log('[liveData] getPressure: Database not initialized.', 'error');
        return;
    }
    const pressureCollection = mainDb.collection('pressures');
    const weatherLocationsCollection = mainDb.collection('weatherLocations');
    const locations = await weatherLocationsCollection.find({}).toArray();

    for (const location of locations) {
        try {
            const url = `${config.weather.api.url}?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${config.weather.apiKey}`;
            const response = await fetchWithTimeoutAndRetry(url, { timeout: config.weather.api.timeout, retries: config.weather.api.retries, name: 'Weather API' });
            const data = await response.json();
            const pressure = data.main.pressure;
            const newPressureData = { pressure, timeStamp: new Date(), lat: location.lat, lon: location.lon };

            const topic = `${config.mqtt.pressureTopic}/${location.lat},${location.lon}`;
            mqttClient.publish(topic, JSON.stringify(newPressureData));
            await pressureCollection.insertOne(newPressureData);
            log(`[liveData] Fetched and stored pressure for location ${location.lat}, ${location.lon}`);
        } catch (error) {
            log(`Error getting pressure for location ${location.lat}, ${location.lon}: ${error.message}`, 'error');
            if (config.env !== 'production') {
                log(`[liveData] Simulating pressure data for location ${location.lat}, ${location.lon}`);
                const pressure = 1000 + Math.random() * 20;
                const newPressureData = { pressure, timeStamp: new Date(), lat: location.lat, lon: location.lon };
                const topic = `${config.mqtt.pressureTopic}/${location.lat},${location.lon}`;
                mqttClient.publish(topic, JSON.stringify(newPressureData));
                await pressureCollection.insertOne(newPressureData);
            }
        }
    }
}

async function close() {
    intervalIds.forEach(clearInterval);
    intervalIds = [];
    await mqttClient.close();
    initialized = false;
}

module.exports = {
    init,
    setAutoUpdate,
    version,
    get intervals() {
        return {
            quakes: config.api.quakes.interval,
            iss: config.api.iss.interval,
            pressure: config.weather.api.interval,
        };
    },
    close,
};