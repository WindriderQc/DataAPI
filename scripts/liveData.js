const fs = require('fs');
const CSVToJSON = require('csvtojson');
const mqttClient = require('./mqttClient.js');

const quakes_url = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv';
const quakesPath = "./data/quakes.csv";

let dbs; // To store database connections

let datas = { version: 1.0 };
const version = datas.version;
const intervals = { quakes: 1000 * 60 * 60 * 24 * 7, iss: 1000 * 5 };
const maxISSlogs = 4320;

async function getISS() {
    const iss_api_url = 'https://api.wheretheiss.at/v1/satellites/25544';
    if (!dbs || !dbs.datas) {
        console.error('[liveData] getISS: Database not initialized.');
        return;
    }
    const issCollection = dbs.datas.collection('isses');

    try {
        const response = await fetch(iss_api_url);
        const data = await response.json();
        const { latitude, longitude } = data;

        const timeStamp = new Date();

        datas.iss = { latitude, longitude, timeStamp };
        const topic = process.env.MQTT_ISS_TOPIC || 'sbqc/iss';
        mqttClient.publish(topic, datas.iss);

        const countBefore = await issCollection.countDocuments();

        if (countBefore >= maxISSlogs) {
            const oldestDoc = await issCollection.findOne({}, { sort: { timeStamp: 1 } });
            if (oldestDoc) {
                await issCollection.deleteOne({ _id: oldestDoc._id });
            }
        }

        await issCollection.insertOne(datas.iss);
    } catch (error) {
        console.log(error, 'Better luck next time getting ISS location...  Keep Rolling! ');
    }
}

async function getQuakes() {
    if (!dbs || !dbs.datas) {
        console.error('[liveData] getQuakes: Database not initialized.');
        return;
    }
    const quakesCollection = dbs.datas.collection('quakes');

    try {
        const response = await fetch(quakes_url);
        const data = await response.text();
        fs.writeFileSync(quakesPath, data);
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

function init(dbConnections) {
    dbs = dbConnections;

    if (!fs.existsSync(quakesPath)) {
        console.log("No Earthquakes datas, requesting data to API now and will actualize daily.", quakesPath, "interval:", intervals.quakes);
    } else {
        console.log('quakes file found');
    }

    mqttClient.init();
    setAutoUpdate(intervals, true);
}

function setAutoUpdate(intervals, updateNow = false) {
    if (updateNow) {
        getQuakes();
        getISS();
    }

    setInterval(getQuakes, intervals.quakes);
    setInterval(getISS, intervals.iss);

    console.log("LiveData configured  -  Intervals: ", intervals);
}

module.exports = {
    init,
    setAutoUpdate,
    version,
    intervals
};