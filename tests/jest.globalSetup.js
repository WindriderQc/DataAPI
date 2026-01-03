const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const URI_FILE = path.join(__dirname, '..', '.jest-mongo-uri');

module.exports = async () => {
  const mongoServer = await MongoMemoryServer.create();
  global.__DATAAPI_MONGOSERVER__ = mongoServer;

  const uri = mongoServer.getUri();
  fs.writeFileSync(URI_FILE, uri, 'utf8');
};
