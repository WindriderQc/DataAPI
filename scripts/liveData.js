const fs = require('fs');
const CSVToJSON = require('csvtojson');
const mqttClient = require('./mqttClient.js');
const config = require('../config/config');

let datasDb; // To store the 'datas' database connection

let datas = { version: 1.0 };
const version = datas.version;
let intervalIds = [];

const dns = require('dns');
const util = require('util');

// Promisify the dns.lookup function for async/await usage
const lookup = util.promisify(dns.lookup);

async function getISS() {
    if (!datasDb) {
        console.error('[liveData] getISS: Database not initialized.');
        return;
    }
    const issCollection = datasDb.collection('isses');
    const issApiUrl = new URL(config.api.iss.url);

    try {
        // Resolve the hostname to an IPv4 address to avoid potential DNS/IPv6 issues
        const { address } = await lookup(issApiUrl.hostname, { family: 4 });
        const resolvedUrl = `${issApiUrl.protocol}//${address}${issApiUrl.pathname}`;

        console.log(`[liveData] Fetching ISS location from resolved URL: ${resolvedUrl}`);

        const response = await fetch(resolvedUrl, {
            headers: { 'Host': issApiUrl.hostname } // Preserve the original hostname for the Host header
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
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
        console.error('[liveData] Failed to get ISS location. Please check the network connection and API status.');
        console.error('Error details:', error);
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