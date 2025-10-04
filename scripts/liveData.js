const fs = require('fs');
const CSVToJSON = require('csvtojson');
const mqttClient = require('./mqttClient.js');
const config = require('../config/config');

let datasDb; // To store the 'datas' database connection

let datas = { version: 1.0 };
const version = datas.version;
let intervalIds = [];

async function getISS() {
    if (!datasDb) {
        console.error('[liveData] getISS: Database not initialized.');
        return;
    }
    const issCollection = datasDb.collection('isses');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
        const response = await fetch(config.api.iss.url, { signal: controller.signal });
        clearTimeout(timeoutId); // Clear the timeout if the request succeeds

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const { latitude, longitude } = data;
        const timeStamp = new Date();

        datas.iss = { latitude, longitude, timeStamp };
        mqttClient.publish(config.mqtt.issTopic, datas.iss);

        const countBefore = await issCollection.countDocuments();
        if (countBefore >= config.api.iss.maxLogs) {
            const oldestDoc = await issCollection.findOne({}, { sort: { timeStamp: 1 } });
            if (oldestDoc) {
                await issCollection.deleteOne({ _id: oldestDoc._id });
            }
        }

        await issCollection.insertOne(datas.iss);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[liveData] ISS API request timed out after 5 seconds.');
        } else {
            console.error('[liveData] Failed to get ISS location:', error.message);
        }
    }
}

async function getQuakes() {
    if (!datasDb) {
        console.error('[liveData] getQuakes: Database not initialized.');
        return;
    }
    const quakesCollection = datasDb.collection('quakes');

    try {
        const response = await fetch(config.api.quakes.url);
        const data = await response.text();
        fs.writeFileSync(config.api.quakes.path, data);
        const quakes = await CSVToJSON().fromString(data);

        console.log('Flushing the Quake collection...');
        await quakesCollection.deleteMany({});
        console.log('Quake collection flushed.');

        if (quakes.length > 0) {
            await quakesCollection.insertMany(quakes, { ordered: false }).catch(err => {
                if (err.code !== 11000) { // Ignore duplicate key errors
                    console.log('Error saving Quake locations to database:', err);
                }
            });
        }
    } catch (error) {
        console.log(error, 'Better luck next time getting quakes...  Keep Rolling! ');
    }
}

function init(dbConnection) {
    datasDb = dbConnection;

    if (!fs.existsSync(config.api.quakes.path)) {
        console.log("No Earthquakes datas, requesting data to API now and will actualize daily.", config.api.quakes.path, "interval:", config.api.quakes.interval);
    } else {
        console.log('quakes file found');
    }

    mqttClient.init();

    // Do not run intervals in the test environment
    if (config.env !== 'test') {
        setAutoUpdate(true);
    }
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