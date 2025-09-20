const fs = require('fs');
//const mongoose = require('mongoose')
const CSVToJSON = require('csvtojson')

const mqttClient = require('./mqttClient.js')

// Get datas from various API at reccurent intervals, save to mongodb and post actualization on mqtt



const Iss = require('../models/issModel')
const Quake = require('../models/quakeModel')

const quakes_url = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv'
const quakesPath = "./data/quakes.csv";






// let io = null

let datas = { version: 1.0 }
const version = datas.version
const intervals = { quakes:1000*60*60*24*7, iss: 1000*5 }   //   weekly ,  each 5 sec
const maxISSlogs = 4320  //  //  24hrs of data at 20 sec interval = 4320 logs


async function getISS() 
{
    const iss_api_url = 'https://api.wheretheiss.at/v1/satellites/25544';

    try {  
        const response = await fetch(iss_api_url)
        const data = await response.json()
        const { latitude, longitude } = data
      
        const timeStamp = new Date()
     
        datas.iss = { latitude, longitude, timeStamp }
        const topic = process.env.MQTT_ISS_TOPIC || 'sbqc/iss';
        mqttClient.publish(topic, datas.iss);
      
        const countBefore = await Iss.countDocuments();

        if (countBefore >= maxISSlogs) {
            // Delete the oldest document
            const deletedDoc = await Iss.findOneAndDelete({},{ sort: { timeStamp: 1 } });
            //console.log('Deleted document:', deletedDoc);
        }
 
         // Log the count after deletion
         //const countAfter = await Iss.countDocuments();
         //console.log(`Count before deletion: ${countBefore}  -  Count after deletion: ${countAfter}`);
 

        // Save the new post
        const post = new Iss(datas.iss)
        await post.save()
    } 
    catch (error) {        console.log(error, 'Better luck next time getting ISS location...  Keep Rolling! ')    } 
}



async function getQuakes() 
{
    try 
    {

        const response = await fetch(quakes_url)
        const data = await response.text()
        fs.writeFileSync(quakesPath, data);
        const quakes = await CSVToJSON().fromString(data);  // converts to JSON array
      
        // Flush the collection by deleting all documents
        console.log('Flushing the Quake collection...');
        await Quake.deleteMany({});
        console.log('Quake collection flushed.');

        quakes.forEach(async (quakeData) => {
            const post = new Quake({
              time: quakeData.time,
              latitude: quakeData.latitude,
              longitude: quakeData.longitude,
              depth: quakeData.depth,
              mag: quakeData.mag,
              magType: quakeData.magType,
              place: quakeData.place,
              type: quakeData.type,
              status: quakeData.status,
              locationSource: quakeData.locationSource,
              magSource: quakeData.magSource
            });

            try {
                    const ack = await  post.save();
                    //console.log('Quake location saved successfully:', ack);
                } catch (err) {
                    console.log('Error saving Quake location to database err: ', err);
                }

        });
    
    } catch (error) {    console.log(error, 'Better luck next time getting quakes...  Keep Rolling! ')     }

}

async function getZonAnn() {
    const url = 'http://data.giss.nasa.gov/gistemp/tabledata_v4/ZonAnn.Ts+dSST.csv';
    const timeout = 5000; // Set timeout in milliseconds

    const controller = new AbortController();
    const signal = controller.signal;

    // Set a timeout to abort the fetch request
    const fetchTimeout = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        const response = await fetch(url);
        clearTimeout(fetchTimeout); // Clear the timeout if fetch is successful
        const data = await response.text();

        const table = data.split('\n').slice(1); // slice deletes line 1

        let temps = {};

        table.forEach(row => {
            const columns = row.split(',');
            const year = columns[0];
            const temp = columns[1];

            //console.log(year, temp)
            temps[year] = temp;
        });

        return temps; // Return the complete temps object
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Fetch request timed out');
        } else {
            console.error('Fetch request failed', error);
        }
        return null; // Return null or handle the error as needed
    }
}

function init()
{
    if (!fs.existsSync(quakesPath)) {
        console.log("No Earthquakes datas, requesting data to API now and will actualize daily.", quakesPath , "interval:", intervals.quakes);
    }
    else console.log('quakes file found')

    mqttClient.init();
    setAutoUpdate(intervals, true)
}




// const intervals = { quakes:1000*60*60*24*7, iss: 1000*5 }
function setAutoUpdate(intervals, updateNow = false)   //  update is done during init.  updateNow is useful is changing the interval from long to short and want current data at runtime
{
    
    if(updateNow) {
        getQuakes()
        getISS()
    }

    setInterval(getQuakes,intervals.quakes) // 24*60*60*1000)  
    setInterval(getISS, intervals.iss) //10*1000)            

    console.log("LiveData configured  -  Intervals: ", intervals )
}


module.exports = {
    init,
    setAutoUpdate, 
    version, 
    intervals,
    getZonAnn
  };