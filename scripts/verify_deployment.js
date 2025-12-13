#!/usr/bin/env node

/**
 * verify_deployment.js
 *
 * This script verifies the deployment of the DataAPI application.
 * It checks:
 * 1. MongoDB connectivity
 * 2. MQTT Broker connectivity
 * 3. Web Server /health endpoint
 *
 * Usage: node scripts/verify_deployment.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const http = require('http');

const COLORS = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function log(msg, color = COLORS.reset) {
    console.log(`${color}${msg}${COLORS.reset}`);
}

async function checkMongoDB() {
    log('\nChecking MongoDB...', COLORS.yellow);
    const mongoUrl = process.env.MONGO_URL;
    const dbName = process.env.MONGO_DB_NAME;

    if (!mongoUrl) {
        log('FAIL: MONGO_URL not set in environment', COLORS.red);
        return false;
    }

    try {
        log(`Connecting to ${mongoUrl}...`);
        await mongoose.connect(mongoUrl, {
            dbName: dbName || 'IoT',
        });
        log('SUCCESS: MongoDB connected', COLORS.green);
        await mongoose.disconnect();
        return true;
    } catch (err) {
        log(`FAIL: MongoDB connection error: ${err.message}`, COLORS.red);
        return false;
    }
}

async function checkMQTT() {
    log('\nChecking MQTT...', COLORS.yellow);
    const brokerUrl = process.env.MQTT_BROKER_URL;
    const username = process.env.MQTT_USERNAME;
    const password = process.env.MQTT_PASSWORD;

    if (!brokerUrl) {
        log('FAIL: MQTT_BROKER_URL not set in environment', COLORS.red);
        return false;
    }

    return new Promise((resolve) => {
        log(`Connecting to ${brokerUrl}...`);
        const client = mqtt.connect(brokerUrl, {
            username: username,
            password: password,
            connectTimeout: 5000
        });

        const timeout = setTimeout(() => {
             if (client.connected) return;
             log('FAIL: MQTT connection timed out', COLORS.red);
             client.end();
             resolve(false);
        }, 6000);

        client.on('connect', () => {
            clearTimeout(timeout);
            log('SUCCESS: MQTT connected', COLORS.green);
            client.end();
            resolve(true);
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            log(`FAIL: MQTT connection error: ${err.message}`, COLORS.red);
            client.end();
            resolve(false);
        });
    });
}

async function checkWebServer() {
    log('\nChecking Web Server...', COLORS.yellow);
    const host = process.env.HOST || 'localhost';
    const port = process.env.PORT || 3003;
    const url = `http://${host}:${port}/health`;

    return new Promise((resolve) => {
        log(`Fetching ${url}...`);
        http.get(url, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.ok) {
                            log('SUCCESS: Web Server is healthy', COLORS.green);
                            resolve(true);
                        } else {
                            log(`FAIL: Web Server returned 200 but invalid health check: ${data}`, COLORS.red);
                            resolve(false);
                        }
                    } catch (e) {
                        log(`FAIL: Web Server returned 200 but invalid JSON: ${data}`, COLORS.red);
                        resolve(false);
                    }
                });
            } else {
                log(`FAIL: Web Server returned status ${res.statusCode}`, COLORS.red);
                resolve(false);
            }
        }).on('error', (err) => {
            log(`FAIL: Web Server request error: ${err.message}`, COLORS.red);
            resolve(false);
        });
    });
}

async function run() {
    log('Starting Deployment Verification...', COLORS.yellow);

    const mongoOk = await checkMongoDB();
    const mqttOk = await checkMQTT();
    // Give the server a moment to start if this is running in a startup script,
    // but here we assume it's already running.
    const serverOk = await checkWebServer();

    log('\nVerification Summary:', COLORS.yellow);
    log(`MongoDB: ${mongoOk ? 'PASS' : 'FAIL'}`, mongoOk ? COLORS.green : COLORS.red);
    log(`MQTT:    ${mqttOk ? 'PASS' : 'FAIL'}`, mqttOk ? COLORS.green : COLORS.red);
    log(`Server:  ${serverOk ? 'PASS' : 'FAIL'}`, serverOk ? COLORS.green : COLORS.red);

    if (mongoOk && mqttOk && serverOk) {
        log('\nAll systems operational.', COLORS.green);
        process.exit(0);
    } else {
        log('\nSome checks failed.', COLORS.red);
        process.exit(1);
    }
}

run();
