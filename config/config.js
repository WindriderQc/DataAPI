'use strict';

// Load environment variables from .env file
require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    server: {
        port: parseInt(process.env.PORT, 10) || 3003,
    },
    db: {
        connectionString: process.env.DB_CONNECTION_STRING || 'mongodb://127.0.0.1:27017/',
        appDbNames: (process.env.DB_APP_DB_NAMES || 'SBQC,datas').split(','),
        modelDbName: process.env.DB_MODEL_DB_NAME || 'SBQC',
        defaultDbName: process.env.DB_DEFAULT_DB_NAME || 'SBQC',
    },
    session: {
        name: 'data-api.sid',
        secret: process.env.SESSION_SECRET || 'a_very_secret_key_that_should_be_changed',
        maxAge: parseInt(process.env.SESSION_MAX_AGE_MS, 10) || 24 * 60 * 60 * 1000, // 1 day
    },
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    api: {
        iss: {
            url: process.env.ISS_API_URL || 'http://api.open-notify.org/iss-now.json',
            interval: parseInt(process.env.ISS_API_INTERVAL_MS, 10) || 5000,
            maxLogs: parseInt(process.env.ISS_MAX_LOGS, 10) || 1000,
        },
        quakes: {
            url: process.env.QUAKES_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv',
            interval: parseInt(process.env.QUAKES_API_INTERVAL_MS, 10) || 24 * 60 * 60 * 1000, // 1 day
            path: process.env.QUAKES_DATA_PATH || './data/quakes.csv',
        },
    },
    mqtt: {
        brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com',
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        issTopic: process.env.MQTT_ISS_TOPIC || 'liveData/iss',
    }
};

module.exports = config;