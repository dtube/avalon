var db_name = process.env.DB_NAME || 'avalon';
var db_url = process.env.DB_URL || 'mongodb://localhost:27017';
var MongoClient = require('mongodb').MongoClient;

var mongo = {
    init: (cb) => {
        MongoClient.connect(db_url, { useNewUrlParser: true }, function(err, client) {
            if (err) throw err;
            this.db = client.db(db_name);
            console.log("Connected to "+db_url+"/"+this.db.databaseName);

            // init genesis account if no account
            db.collection('accounts').findOne({}, function(err, acc) {
                if (err) throw err;

                if (acc) {
                    cb()
                    return
                }

                console.log('NEW CHAIN !!')
                
                if (!acc) {
                    db.collection('accounts').insertOne({
                        name: 'master',
                        pub: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz',
                        balance: 1000000,
                        approves: ['master'],
                        node_appr: 1000000
                    })
                    // then init genesis block if no block
                    db.collection('blocks').findOne({}, function(err, block) {
                        if (err) throw err;
                        if (!block) {
                            var block = chain.getGenesisBlock()
                            db.collection('blocks').insertOne(block, function() {
                                cb()
                            })
                        } else {
                            cb()
                        }
                    })
                }
            })
            
        });
    },
    fillInMemoryBlocks: (cb) => {
        db.collection('blocks').find({}, {
            sort: {index: -1},
            limit: 100
        }).toArray(function(err, blocks) {
            if (err) throw err;
            tempBlocks = blocks
            cb()
        })
    }
} 

module.exports = mongo