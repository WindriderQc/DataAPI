'use strict';

// Load environment variables from .env file
require('dotenv').config();

const oneDayInMs = 24 * 60 * 60 * 1000;
const minSessionAge = 60 * 1000; // 1 minute
const parsedMaxAge = parseInt(process.env.SESSION_MAX_AGE_MS, 10);
const sessionMaxAge = (!isNaN(parsedMaxAge) && parsedMaxAge > minSessionAge) ? parsedMaxAge : oneDayInMs;

// Determine environment
const env = process.env.NODE_ENV || 'development';

// Use a single database name per environment:
// - production -> 'datas'
// - non-production (development, staging, etc.) -> 'devdatas'
// Allow overriding via MONGO_DB_NAME if needed.
const defaultProdDb = 'datas';
const defaultDevDb = 'devdatas';
const mainDbName = process.env.MONGO_DB_NAME || (env === 'production' ? defaultProdDb : defaultDevDb);
const devDbName = defaultDevDb;


const config = {
    env: env,
    server: {
        port: parseInt(process.env.PORT, 10) || 3003,
    },
    db: {
        // Construct a safe connection string; if MONGO_URL is provided it should include the host
        // and we'll append the database name and any options if present. If no MONGO_URL is set,
        // fall back to a local mongodb URI.
        connectionString: (process.env.MONGO_URL ? (process.env.MONGO_URL + mainDbName + (process.env.MONGO_OPTIONS || '')) : 'mongodb://127.0.0.1:27017/'),
        // List of all database names managed by the application. We only create one DB handle
        // per environment (mainDbName).
        appDbNames: [mainDbName, devDbName],
        // The primary database for core application models (e.g., users, sessions)
        mainDb: mainDbName,
        devDb: devDbName,
    // Note: use `mainDb` key throughout the codebase
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
            url: process.env.ISS_API_URL || 'http://api.open-notify.org/iss-now.json', //'https://api.wheretheiss.at/v1/satellites/25544', //'http://api.open-notify.org/iss-now.json',
            interval: parseInt(process.env.ISS_API_INTERVAL_MS, 10) || 5000,
            // How long to wait for the HTTP request before aborting (ms)
            timeout: parseInt(process.env.ISS_FETCH_TIMEOUT_MS, 10) || 5000,
            // Number of retry attempts on failure
            retries: parseInt(process.env.ISS_FETCH_RETRIES, 10) || 2,
            maxLogs: parseInt(process.env.ISS_MAX_LOGS, 10) || 1000,
        },
        quakes: {
            url: process.env.QUAKES_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv',
            interval: parseInt(process.env.QUAKES_API_INTERVAL_MS, 10) || oneDayInMs, // 1 day
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