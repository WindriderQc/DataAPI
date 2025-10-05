'use strict';

// Load environment variables from .env file
require('dotenv').config();

const oneDayInMs = 24 * 60 * 60 * 1000;
const minSessionAge = 60 * 1000; // 1 minute
const parsedMaxAge = parseInt(process.env.SESSION_MAX_AGE_MS, 10);
const sessionMaxAge = (!isNaN(parsedMaxAge) && parsedMaxAge > minSessionAge) ? parsedMaxAge : oneDayInMs;

// Determine database name prefix based on environment
const env = process.env.NODE_ENV || 'development';
const dbNamePrefix = env === 'production' ? '' : 'dev';

// Define base database names
const mainDbName = 'SBQC';
const dataDbName = 'datas';

// Construct final database names with environment prefix
const finalMainDbName = `${dbNamePrefix}${mainDbName}`;
const finalDataDbName = `${dbNamePrefix}${dataDbName}`;

const config = {
    env: env,
    server: {
        port: parseInt(process.env.PORT, 10) || 3003,
    },
    db: {
        connectionString: process.env.DB_CONNECTION_STRING || 'mongodb://127.0.0.1:27017/',
        // List of all database names managed by the application
        appDbNames: [finalMainDbName, finalDataDbName],
        // The primary database for core application models (e.g., users, sessions)
        mainDb: finalMainDbName,
        // The database for logging time-series data from external sources
        dataDb: finalDataDbName,
        // The modelDbName is the main database
        modelDbName: finalMainDbName,
        // The defaultDbName is now the main database
        defaultDbName: finalMainDbName,
    },
    session: {
        name: 'data-api.sid',
        secret: process.env.SESSION_SECRET || 'a_very_secret_key_that_should_be_changed',
        maxAge: sessionMaxAge,
        cookie_domain: process.env.SESSION_COOKIE_DOMAIN,
    },
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    api: {
        // Global defaults for fetch timeouts and retries (can be overridden per-endpoint)
        defaultFetchTimeout: parseInt(process.env.DEFAULT_FETCH_TIMEOUT_MS, 10) || 8000,
        defaultFetchRetries: parseInt(process.env.DEFAULT_FETCH_RETRIES, 10) || 1,
        iss: {
            url: process.env.ISS_API_URL || 'http://api.open-notify.org/iss-now.json',
            interval: parseInt(process.env.ISS_API_INTERVAL_MS, 10) || 5000,
            // How long to wait for the HTTP request before aborting (ms)
            timeout: parseInt(process.env.ISS_FETCH_TIMEOUT_MS, 10) || 5000,
            // Number of retry attempts on failure
            retries: parseInt(process.env.ISS_FETCH_RETRIES, 10) || 2,
            maxLogs: parseInt(process.env.ISS_MAX_LOGS, 10) || 1000,
        },
        quakes: {
            url: process.env.QUAKES_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv',
            interval: parseInt(process.env.QUAKES_API_INTERVAL_MS, 10) || 24 * 60 * 60 * 1000, // 1 day
            // How long to wait for the HTTP request before aborting (ms)
            timeout: parseInt(process.env.QUAKES_FETCH_TIMEOUT_MS, 10) || 15000,
            // Number of retry attempts on failure
            retries: parseInt(process.env.QUAKES_FETCH_RETRIES, 10) || 2,
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