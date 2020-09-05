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
rebuild = require('./rebuild')

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
    var timeStart = new Date().getTime()
    cache.warmup('accounts', parseInt(process.env.WARMUP_ACCOUNTS), function(err) {
        if (err) throw err
        logr.info(Object.keys(cache.accounts).length+' acccounts loaded in RAM in '+(new Date().getTime()-timeStart)+' ms')
        timeStart = new Date().getTime()
        
        cache.warmup('contents', parseInt(process.env.WARMUP_CONTENTS), function(err) {
            if (err) throw err
            logr.info(Object.keys(cache.contents).length+' contents loaded in RAM in '+(new Date().getTime()-timeStart)+' ms')

            // Rebuild chain state if specified. This verifies the integrity of every block and transactions and rebuild the state.
            if (process.env.REBUILD_STATE === '1' || process.env.REBUILD_STATE === 1) {
                logr.info('Chain state rebuild requested, unzipping blocks.zip...')
                mongo.restoreBlocks((e)=>{
                    if (e) return logr.error(e)

                })
                return
            }

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

                    // regularly clean up old txs from mempool
                    setInterval(function() {
                        transaction.cleanPool()
                    }, config.blockTime*0.9)
                })
            })
        })
    })
})

process.on('SIGINT', function() {
    if (typeof closing !== 'undefined') return
    closing = true
    logr.warn('Waiting '+config.blockTime+' ms before shut down...')
    chain.shuttingDown = true
    setTimeout(function() {
        logr.info('Avalon exitted safely')
        process.exit(0)
    }, config.blockTime)
})