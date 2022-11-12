// starting sub modules
logr = require('./logger.js')
config = require('./config.js').read(0)
p2p = require('./p2p.js')
chain = require('./chain.js')
transaction = require('./transaction.js')
cache = require('./cache.js')
validate = require('./validate')
eco = require('./economics.js')
rankings = require('./rankings.js')
consensus = require('./consensus')
leaderStats = require('./leaderStats')

const dao = require('./dao')
const daoMaster = require('./daoMaster')
const blocks = require('./blocks')
const mongo = require('./mongo')
const http = require('./http')

// verify node version
const allowNodeV = [14, 16, 18]
const currentNodeV = parseInt(process.versions.node.split('.')[0])
if (allowNodeV.indexOf(currentNodeV) === -1) {
    logr.fatal('Wrong NodeJS version. Allowed versions: v'+allowNodeV.join(', v'))
    process.exit(1)
} else logr.info('Correctly using NodeJS v'+process.versions.node)

let erroredRebuild = false

// init the database and load most recent blocks in memory directly
mongo.init(async function(state) {
    // init blocks BSON if not using mongodb for blocks
    await blocks.init(state)

    // Warmup accounts
    let timeStart = new Date().getTime()
    await cache.warmup('accounts', parseInt(process.env.WARMUP_ACCOUNTS))
    logr.info(Object.keys(cache.accounts).length+' acccounts loaded in RAM in '+(new Date().getTime()-timeStart)+' ms')
    
    // Warmup contents
    timeStart = new Date().getTime()
    await cache.warmup('contents', parseInt(process.env.WARMUP_CONTENTS))
    logr.info(Object.keys(cache.contents).length+' contents loaded in RAM in '+(new Date().getTime()-timeStart)+' ms')
    
    // Warmup leaders
    timeStart = new Date().getTime()
    let leaderCount = await cache.warmupLeaders()
    logr.info(leaderCount+' leaders loaded in RAM in '+(new Date().getTime()-timeStart)+' ms')

    // Warmup leader stats
    await leaderStats.loadIndex()

    // Load proposal head ID and active proposals
    await dao.loadID()
    await dao.loadActiveFundRequests()
    await dao.loadActiveChainUpdateProposals()
    await dao.loadGovConfig()
    await daoMaster.loadID()

    // Rebuild chain state if specified
    let rebuildResumeBlock = state && state.headBlock ? state.headBlock+1 : 0
    let isResumingRebuild = process.env.REBUILD_STATE === '1' && rebuildResumeBlock

    // alert when rebuild without validation/signture verification, only use if you know what you are doing
    if (process.env.REBUILD_STATE === '1')
        if (process.env.REBUILD_NO_VALIDATE === '1')
            logr.info('Rebuilding without validation. Only use this if you know what you are doing!')
        else if (process.env.REBUILD_NO_VERIFY === '1')
            logr.info('Rebuilding without signature verification. Only use this if you know what you are doing!')

    if (process.env.REBUILD_STATE === '1' && !isResumingRebuild) {
        logr.info('Chain state rebuild requested'+(process.env.UNZIP_BLOCKS === '1' && !blocks.isOpen ? ', unzipping blocks.zip...' : ''))
        if (!blocks.isOpen)
            mongo.restoreBlocks((e)=>{
                if (e) return logr.error(e)
                startRebuild(0)
            })
        else
            startRebuild(0)
        return
    }

    let block = blocks.isOpen ? blocks.lastBlock() : await mongo.lastBlock()
    // Resuming an interrupted rebuild
    if (isResumingRebuild) {
        logr.info('Resuming interrupted rebuild from block ' + rebuildResumeBlock)
        config = require('./config').read(rebuildResumeBlock - 1)
        chain.restoredBlocks = block._id
        let blkScheduleStart = rebuildResumeBlock-1 - (rebuildResumeBlock-1)%config.leaders
        if (!blocks.isOpen)
            mongo.fillInMemoryBlocks(() => 
                db.collection('blocks').findOne({_id:rebuildResumeBlock-1 - (rebuildResumeBlock-1)%config.leaders},(e,b) => {
                    chain.schedule = chain.minerSchedule(b)
                    startRebuild(rebuildResumeBlock)
                }),rebuildResumeBlock)
        else {
            blocks.fillInMemoryBlocks(rebuildResumeBlock)
            chain.schedule = chain.minerSchedule(blocks.read(blkScheduleStart))
            startRebuild(rebuildResumeBlock)
        }
        return
    }
    logr.info('#' + block._id + ' is the latest block in our db')
    config = require('./config.js').read(block._id)
    if (blocks.isOpen) {
        blocks.fillInMemoryBlocks()
        startDaemon()
    } else
        mongo.fillInMemoryBlocks(startDaemon)
})

function startRebuild(startBlock) {
    let rebuildStartTime = new Date().getTime()
    chain.lastRebuildOutput = rebuildStartTime
    chain.rebuildState(startBlock,(e,headBlockNum) => {
        if (e) {
            erroredRebuild = true
            return logr.error('Error rebuilding chain at block',headBlockNum, e)
        } else if (headBlockNum <= chain.restoredBlocks)
            logr.info('Rebuild interrupted at block '+headBlockNum+', so far it took ' + (new Date().getTime() - rebuildStartTime) + ' ms.')
        else
            logr.info('Rebuilt ' + headBlockNum + ' blocks successfully in ' + (new Date().getTime() - rebuildStartTime) + ' ms')
        logr.info('Writing rebuild data to disk...')
        let cacheWriteStart = new Date().getTime()
        cache.writeToDisk(true,() => {
            logr.info('Rebuild data written to disk in ' + (new Date().getTime() - cacheWriteStart) + ' ms')
            if (chain.shuttingDown || process.env.TERMINATE_AFTER_REBUILD === '1') {
                if (blocks.isOpen)
                    blocks.close()
                return process.exit(0)
            }
            startDaemon()
        })
    })
}

function startDaemon() {
    // start miner schedule
    let blkScheduleStart = chain.getLatestBlock()._id - (chain.getLatestBlock()._id % config.leaders)
    if (blocks.isOpen)
        chain.schedule = chain.minerSchedule(blocks.read(blkScheduleStart))
    else
        db.collection('blocks').findOne({_id: blkScheduleStart}, function(err, block) {
            if (err) throw err
            chain.schedule = chain.minerSchedule(block)
        })

    // init hot/trending
    rankings.init()
    // start the http server
    http.init()
    // start the websocket server
    p2p.init()
    // and connect to peers
    p2p.connect(process.env.PEERS ? process.env.PEERS.split(',') : [], true)
    // keep peer connection alive
    setTimeout(p2p.keepAlive,3000)

    // regularly clean up old txs from mempool
    setInterval(function() {
        transaction.cleanPool()
    }, config.blockTime*0.9)
}

process.on('SIGINT', function() {
    if (typeof closing !== 'undefined') return
    closing = true
    chain.shuttingDown = true
    if (!erroredRebuild && chain.restoredBlocks && chain.getLatestBlock()._id < chain.restoredBlocks) return
    process.stdout.write('\r')
    logr.info('Received SIGINT, completing writer queue...')
    setInterval(() => {
        blocks.close()
        if (cache.writerQueue.queue.length === 0 && !cache.writerQueue.processing) {
            logr.info('Avalon exitted safely')
            process.exit(0)
        }
    },1000)
})