var log4js = require('log4js');

log4js.configure({
  appenders: {
    out: { type: 'stdout', layout: {
      type: 'pattern',
      pattern: '%[%d{hh:mm:ss.SSS} [%p]%] %m',
    }}
  },
  categories: { default: { appenders: ['out'], level: 'info' } }
})

var logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';
logger.info("Logger initialized");
module.exports = logger