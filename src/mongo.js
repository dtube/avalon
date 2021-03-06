const db_name = process.env.DB_NAME || 'avalon'
const db_url = process.env.DB_URL || 'mongodb://localhost:27017'
const MongoClient = require('mongodb').MongoClient
const fs = require('fs')
const sha256File = require('sha256-file')
const spawn = require('child_process').spawn
const spawnSync = require('child_process').spawnSync
let isResumingRebuild = !isNaN(parseInt(process.env.REBUILD_RESUME_BLK)) && parseInt(process.env.REBUILD_RESUME_BLK) > 0

var mongo = {
    init: (cb) => {
        MongoClient.connect(db_url, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, async function(err, client) {
            if (err) throw err
            this.db = client.db(db_name)
            try {
                await this.db.executeDbAdminCommand({
                    setParameter: 1,
                    internalQueryExecMaxBlockingSortBytes: 335544320
                })
            } catch {}
            logr.info('Connected to '+db_url+'/'+this.db.databaseName)

            // If a rebuild is specified, drop the database
            if ((process.env.REBUILD_STATE === '1' || process.env.REBUILD_STATE === 1) && !isResumingRebuild)
                return db.dropDatabase(() => mongo.initGenesis(cb))

            // check if genesis block exists or not
            db.collection('blocks').findOne({_id: 0}, function(err, genesis) {
                if (err) throw err
                if (genesis) {
                    if (genesis.hash !== config.originHash) {
                        logr.fatal('Block #0 hash doesn\'t match config. Did you forget to db.dropDatabase() ?')
                        process.exit(1)
                    }
                    cb()
                } else mongo.initGenesis(cb)
            })
            
        })
    },
    initGenesis: (cb) => {
        if (process.env.REBUILD_STATE === '1' || process.env.REBUILD_STATE === 1)
            logr.info('Starting genesis for rebuild...')
        else
            logr.info('Block #0 not found. Starting genesis...')

        mongo.addMongoIndexes(function() {
            let genesisFolder = process.cwd()+'/genesis/'
            let genesisZip = genesisFolder+'genesis.zip'
            let mongoUri = db_url+'/'+db_name

            // Check if genesis.zip exists
            try {
                fs.statSync(genesisZip)
            } catch (err) {
                logr.warn('No genesis.zip file found')
                // if no genesis file, we create only the master account and empty block 0
                mongo.insertMasterAccount(function() {
                    mongo.insertBlockZero(function() {
                        cb()
                    })
                })
                return
            }
            
            // if there's a genesis file, we unzip and mongorestore it
            logr.info('Found genesis.zip file, checking sha256sum...')
            let fileHash = sha256File(genesisZip)
            logr.debug(config.originHash+'\t config.originHash')
            logr.debug(fileHash+'\t genesis.zip')
            if (fileHash !== config.originHash) {
                logr.fatal('Existing genesis.zip file does not match block #0 hash')
                process.exit(1)
            }
            
            logr.info('OK sha256sum, unzipping genesis.zip...')
            spawnSync('unzip',[genesisZip,'-d',genesisFolder])
            logr.info('Finished unzipping, importing data now...')

            let mongorestore = spawn('mongorestore', ['--uri='+mongoUri, '-d', db_name, genesisFolder])                         
            mongorestore.stderr.on('data', (data) => {
                data = data.toString().split('\n')
                for (let i = 0; i < data.length; i++) {
                    let line = data[i].split('\t')
                    if (line.length > 1 && line[1].indexOf(db_name+'.') > -1)
                        logr.debug(line[1])
                }
            })
            
            mongorestore.on('close', () => {
                logr.info('Finished importing genesis data')
                mongo.insertBlockZero(cb)
            })
        })
    },
    insertMasterAccount: (cb) => {
        logr.info('Inserting new master account: '+config.masterName)
        db.collection('accounts').insertOne({
            name: config.masterName,
            pub: config.masterPub,
            pub_leader: config.masterPubLeader || config.masterPub,
            balance: config.masterBalance,
            bw: {v:0,t:config.block0ts},
            vt: {v:0,t:config.block0ts},
            // we set those arbitrarily
            approves: [config.masterName],
            node_appr: config.masterBalance,
            follows: [],
            followers: [],
            keys: [],
            created: {
                by: '',
                ts: config.block0ts
            }
        })
        cb()     
    },
    insertBlockZero: (cb) => {
        logr.info('Inserting Block #0 with hash '+config.originHash)
        db.collection('blocks').findOne({}, function(err, block) {
            if (err) throw err
            if (!block) {
                let genesisBlock = chain.getGenesisBlock()
                db.collection('blocks').insertOne(genesisBlock, function() {
                    cb()
                })
            } else 
                cb()
            
        })
    },
    addMongoIndexes: (cb) => {
        db.collection('accounts').createIndex( {name:1}, function() {
            db.collection('accounts').createIndex( {balance:1}, function() {
                db.collection('accounts').createIndex( {node_appr:1}, function() {
                    db.collection('contents').createIndex( {ts:1}, function() {
                        db.collection('contents').createIndex( {author:1}, function() {
                            cb()
                        })
                    })
                })
            })
        })
    },
    fillInMemoryBlocks: (cb,headBlock) => {
        let query = {}
        if (headBlock) query._id = {$lt: headBlock}
        db.collection('blocks').find(query, {
            sort: {_id: -1},
            limit: config.ecoBlocksIncreasesSoon ? config.ecoBlocksIncreasesSoon : config.ecoBlocks
        }).toArray(function(err, blocks) {
            if (err) throw err
            chain.recentBlocks = blocks.reverse()
            cb()
        })
    },
    lastBlock: (cb) => {
        db.collection('blocks').findOne({}, {
            sort: {_id: -1}
        }, function(err, block) {
            if (err) throw err
            cb(block)
        })
    },
    restoreBlocks: (cb) => {
        let dump_dir = process.cwd() + '/dump'
        let dump_location = dump_dir + '/blocks.zip'
        let mongoUri = db_url+'/'+db_name

        try {
            fs.statSync(dump_location)
        } catch (err) {
            return cb('blocks.zip file not found')
        }

        // Drop the existing blocks collection and replace with the dump
        db.collection('blocks').drop((e,ok) => {
            if (!ok) return cb('Failed to drop existing blocks data')

            spawnSync('unzip',[dump_location,'-d',dump_dir])
            logr.info('Finished unzipping, importing blocks now...')

            let mongorestore = spawn('mongorestore', ['--uri='+mongoUri, '-d', db_name, dump_dir])                         
            mongorestore.stderr.on('data', (data) => {
                data = data.toString().split('\n')
                for (let i = 0; i < data.length; i++) {
                    let line = data[i].split('\t')
                    if (line.length > 1 && line[1].indexOf(db_name+'.') > -1)
                        logr.debug(line[1])
                }
            })
            
            mongorestore.on('close', () => db.collection('blocks').findOne({_id: 0}, (gError,gBlock) => mongo.lastBlock((block) => {
                if (gError) throw gError
                if (!gBlock) return cb('Genesis block not found in dump')
                if (gBlock.hash !== config.originHash)return cb('Genesis block hash in dump does not match config.originHash')

                logr.info('Finished importing ' + block._id + ' blocks')
                chain.restoredBlocks = block._id
                cb(null)
            })))
        })
    }
} 

module.exports = mongo