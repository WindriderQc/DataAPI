const fs = require('fs');
const path = require('path');

const URI_FILE = path.join(__dirname, '..', '.jest-mongo-uri');

module.exports = async () => {
  try {
    if (global.__DATAAPI_MONGOSERVER__) {
      await global.__DATAAPI_MONGOSERVER__.stop();
    }
  } finally {
    try {
      fs.unlinkSync(URI_FILE);
    } catch (e) {
      // ignore
    }
  }
};
