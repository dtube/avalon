http = require('./http.js')
p2p = require('./p2p.js')
mongo = require('./mongo.js')
chain = require('./chain.js')
transaction = require('./transaction.js')

tempBlocks = []
tempTxs = []
schedule = []

// init the database and load most recent blocks in memory directly
mongo.init(function() {
    mongo.fillInMemoryBlocks(function() {
        console.log('#' + chain.getLatestBlock()._id + ' is the latest block in our db')
        
        // start witness schedule
        db.collection('blocks').findOne({_id: chain.getLatestBlock()._id - (chain.getLatestBlock()._id%20)}, function(err, block) {
            if (err) throw err;
            chain.minerSchedule(block, function(minerSchedule) {
                schedule = minerSchedule
            })
        })
        

        // start the http server
        http.init();
        // start the websocket server
        p2p.init();
        // and connect to peers
        p2p.connect(process.env.PEERS ? process.env.PEERS.split(',') : [])
    })
});

process.on('SIGINT', function() {
    console.log('...');
    chain.shuttingDown = true
    setTimeout(function() {
        console.log('Exit');
        process.exit(0);
    }, 3000);
});