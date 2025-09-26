const winston = require('winston');

// Default level is 'info'. You can override this with the LOG_LEVEL env var.
const level = process.env.LOG_LEVEL || 'info';

// Don't log to the console if we're in a test environment.
const silent = process.env.NODE_ENV === 'test';

const logger = winston.createLogger({
  level: level,
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      silent: silent
    }),
  ],
});

// A wrapper around the logger to make it easier to use.
const log = (message, level = 'info') => {
  logger.log(level, message);
};

module.exports = {
  log,
  logger
};