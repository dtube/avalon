let log4js = require('log4js')

log4js.configure({
    levels: {
        CONS: { value: 9000, colour: 'magenta' },
        ECON: { value: 8000, colour: 'blue' },
        PERF: { value: 7000, colour: 'white' },
    },
    appenders: {
        out: { type: 'stdout', layout: {
            type: 'pattern',
            pattern: '%[%d{hh:mm:ss.SSS} [%p]%] %m',
        }},
        file: {
            type: 'file',
            filename: './logs/output.log',
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        }
    },
    categories: { 
        default: { 
            appenders: ['out', 'file'],
            level: process.env.LOG_LEVEL || 'info'
        }
    }
})

let logger = log4js.getLogger()
logger.info('Logger initialized')
module.exports = logger