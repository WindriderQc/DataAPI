const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATAAPI_API_KEY = process.env.DATAAPI_API_KEY || 'test-dataapi-api-key';
process.env.ISS_API_ENABLED = process.env.ISS_API_ENABLED || 'true';
process.env.QUAKES_API_ENABLED = process.env.QUAKES_API_ENABLED || 'true';

// Ensure every Jest worker gets its own DB name (avoids cross-worker collisions when using one shared MongoDB instance).
process.env.MONGO_DB_NAME = process.env.MONGO_DB_NAME || `dataapi_test_${process.env.JEST_WORKER_ID || '0'}`;

const uriFile = path.join(__dirname, '..', '.jest-mongo-uri');
if (!process.env.MONGO_URL) {
  try {
    const uri = fs.readFileSync(uriFile, 'utf8').trim();
    if (uri) process.env.MONGO_URL = uri;
  } catch (e) {
    // If globalSetup didn't run (or file missing), tests may still set MONGO_URL another way.
  }
}
