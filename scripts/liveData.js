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
        const { latitude, longitude } = data;

        const timeStamp = new Date();

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
        log(error, 'Better luck next time getting ISS location...  Keep Rolling!');
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
        log(error, 'Better luck next time getting quakes...  Keep Rolling!');
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

function setAutoUpdate(updateNow = false) {
    const intervals = {
        quakes: config.api.quakes.interval,
        iss: config.api.iss.interval,
    };

    if (updateNow) {
    getQuakes();
    getISS();
    }

    intervalIds.push(setInterval(getQuakes, intervals.quakes));
    intervalIds.push(setInterval(getISS, intervals.iss));

    console.log("LiveData configured  -  Intervals: ", intervals);
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
        };
    },
    close,
};