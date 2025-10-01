require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: process.env.PORT || 3003,
  },

  session: {
    name: process.env.SESS_NAME || 'default-session-name',
    secret: process.env.NODE_ENV === 'test' ? 'test-secret' : (process.env.SESS_SECRET || 'a-very-secure-default-secret-for-development'),
    maxAge: 1000 * 60 * 60, // 1 hour
  },

  db: {
    // For Mongoose models
    modelDbName: process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas',
    // For native driver connections
    appDbNames: ['SBQC', 'datas'],
    defaultDbName: 'datas',
  },

  api: {
    iss: {
      url: 'https://api.wheretheiss.at/v1/satellites/25544',
      maxLogs: 4320,
      interval: 1000 * 5, // 5 seconds
    },
    quakes: {
      url: 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv',
      path: './data/quakes.csv',
      interval: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  },

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    issTopic: process.env.MQTT_ISS_TOPIC || 'sbqc/iss',
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
  },
};