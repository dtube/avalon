// starting sub modules
logr = require('./logger.js')
config = require('./config.js').read(0)
http = require('./http.js')
p2p = require('./p2p.js')
mongo = require('./mongo.js')
chain = require('./chain.js')
transaction = require('./transaction.js')
cache = require('./cache.js')
validate = require('./validate')
eco = require('./economics.js')
rankings = require('./rankings.js')
consensus = require('./consensus')

// verify node version
const nodeV = 10
const versionRegex = new RegExp(`^${nodeV}\\..*`)
const versionCorrect = process.versions.node.match(versionRegex)
if (!versionCorrect) {
    logr.fatal('Wrong NodeJS version. v10 is required.')
    process.exit(1)
} else logr.info('Correctly using NodeJS v'+process.versions.node)


// init the database and load most recent blocks in memory directly
mongo.init(function() {
    mongo.lastBlock(function(block) {
        logr.info('#' + block._id + ' is the latest block in our db')
        config = require('./config.js').read(block._id)
        mongo.fillInMemoryBlocks(function() {
            // start miner schedule
            db.collection('blocks').findOne({_id: chain.getLatestBlock()._id - (chain.getLatestBlock()._id % config.leaders)}, function(err, block) {
                if (err) throw err
                chain.minerSchedule(block, function(minerSchedule) {
                    chain.schedule = minerSchedule
                })
            })
    
            // init hot/trending
            rankings.init()
    
            // start the http server
            http.init()
            // start the websocket server
            p2p.init()
            // and connect to peers
            p2p.connect(process.env.PEERS ? process.env.PEERS.split(',') : [])
        })
    })
})

process.on('SIGINT', function() {
    if (typeof closing !== 'undefined') return
    closing = true
    logr.warn('Waiting '+config.blockTime+' ms before shut down...')
    chain.shuttingDown = true
    setTimeout(function() {
        logr.trace('Avalon exitted safely')
        process.exit(0)
    }, config.blockTime)
})