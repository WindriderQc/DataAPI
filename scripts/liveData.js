const nodeTools = require('nodetools') //nodeTools.readFile("greetings.txt")
//const socketio = require('./socket')
const CSVToJSON = require('csvtojson')
//const moment = require('moment')

const quakes_url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv'
const quakesPath = "./data/quakes.csv";



const Iss = require('../models/issModel')
const Quake = require('../models/quakeModel')

const mongoose = require('mongoose')


//let datas = { version: 1.0 }


async function getISS() 
{
    const iss_api_url = 'https://api.wheretheiss.at/v1/satellites/25544';

    try {
        const response = await fetch(iss_api_url)
        let data = await response.json()
        const { latitude, longitude } = data
        const timeStamp = new Date()
        data = { latitude, longitude, timeStamp }
       
        mongoose.connection.useDb('datas');

        const post = new Iss(data)
        post.save((err) =>{  if (err)  console.log('Error saving Iss location to database   err: ', err, data)        })
    } 
    catch (error) {        console.log(error, 'Better luck next time...  Keep Rolling! ')    } 
}



async function getQuakes() 
{
    try 
    {
        const response = await fetch(quakes_url)
        const data = await response.text()
        nodeTools.saveFile( data, quakesPath)
        const quakes = await CSVToJSON().fromString(data);  // converts to JSON array

        mongoose.connection.useDb('datas');

        quakes.forEach(quakeData => {
            const post = new Quake({
              time: quakeData.time,
              latitude: quakeData.latitude,
              longitude: quakeData.longitude,
              depth: quakeData.depth,
              mag: quakeData.mag,
              // ... other fields ...
            });
          
            post.save(err => {
                if (err) console.log('Error saving Quake location to database err: ', err);
               // else     console.log('Quake location saved successfully.');
            });
        });
    
    } catch (error) {    console.log(error, 'Better luck next time...  Keep Rolling! ')     }

}

async function getZonAnn() 
{
    const response = await fetch('https://data.giss.nasa.gov/gistemp/tabledata_v4/ZonAnn.Ts+dSST.csv')
    const data = await response.text()
  
    const table = data.split('\n').slice(1)   //  slice delete line 1
    
    const datas = {}

    table.forEach(row => {
        const columns = row.split(',')
        const year = columns[0]
        const temp = columns[1]
    
        //console.log(year, temp)
        datas.yearTemp = {year, temp}

        return (datas.yearTemp)  //  TODO:  mais...    ca va retourner juste la premiere ligne du tableau!?
    })
}



function init()
{
    console.log('about to fetch ZoneAnn')
    getZonAnn() 

    if (!nodeTools.isExisting(quakesPath)) {
        console.log("No Earthquakes datas, requesting data to API now and will actualize daily.", path);
        getQuakes()
    }

    getISS()
}




// const intervals = { quakes:1000*60*60*24*7, iss: 1000*5 }
function setAutoUpdate(intervals, updateNow = false)   //  update is done during init.  updateNow is useful is changing the interval from long to short and want current data at runtime
{
    if(updateNow) {
        getQuakes()
        getISS()
    }

    setInterval(getQuakes,intervals.quakes) // 24*60*60*1000)  // daily
    setInterval(getISS, intervals.iss) //10*1000)             // every 10sec

    console.log("LiveData configured  -  Intervals: ", intervals )
}


module.exports = {
    init,
    setAutoUpdate
  };