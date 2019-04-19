var db_name = process.env.DB_NAME || 'avalon'
var db_url = process.env.DB_URL || 'mongodb://localhost:27017'
var MongoClient = require('mongodb').MongoClient

var mongo = {
    init: (cb) => {
        MongoClient.connect(db_url, { useNewUrlParser: true }, function(err, client) {
            if (err) throw err
            this.db = client.db(db_name)
            logr.info('Connected to '+db_url+'/'+this.db.databaseName)

            // init genesis block
            db.collection('blocks').findOne({_id: 0}, function(err, genesis) {
                if (err) throw err

                if (genesis) {
                    console.log(genesis)
                    if (genesis.hash !== config.originHash) {
                        logr.fatal('Block #0 hash doesn\'t match config. Did you forget to db.dropDatabase() ?')
                        process.exit()
                    }
                    cb()
                    return
                }

                logr.debug('NEW CHAIN !!')
                
                if (!genesis) {
                    db.collection('accounts').insertOne({
                        name: config.masterName,
                        pub: config.masterPub,
                        balance: config.masterBalance,
                        bw: {v:0,t:config.block0ts},
                        vt: {v:0,t:config.block0ts},
                        pr: {v:0,t:config.block0ts},
                        uv: 0,
                        // we set those arbitrarily
                        approves: [config.masterName],
                        node_appr: config.masterBalance,
                        follows: [],
                        followers: [],
                        keys: []
                    })
                    // then init genesis block if no block
                    db.collection('blocks').findOne({}, function(err, block) {
                        if (err) throw err
                        if (!block) {
                            var genesisBlock = chain.getGenesisBlock()
                            db.collection('blocks').insertOne(genesisBlock, function() {
                                cb()
                            })
                        } else 
                            cb()
                        
                    })
                }
            })
            
        })
    },
    fillInMemoryBlocks: (cb) => {
        db.collection('blocks').find({}, {
            sort: {_id: -1},
            limit: config.ecoBlocks
        }).toArray(function(err, blocks) {
            if (err) throw err
            chain.recentBlocks = blocks.reverse()
            cb()
        })
    }
} 

module.exports = mongo