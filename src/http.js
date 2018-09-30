var http_port = process.env.HTTP_PORT || 3001;
var express = require("express");
var bodyParser = require('body-parser');
const series = require('run-series')

var http = {
    init: () => {
        var app = express();
        app.use(bodyParser.json());

        // fetch a single block
        app.get('/block/:number', (req, res) => {
            var blockNumber = parseInt(req.params.number)
            db.collection('blocks').findOne({_id: blockNumber}, function(err, block) {
                if (err) throw err;
                res.send(block)
            })
        });
        
        // count how many blocks are in the node
        app.get('/count', (req, res) => {
            db.collection('blocks').countDocuments(function(err, count) {
                if (err) throw err;
                res.send({
                    count: count
                })
            })
        });

        // generate a new key pair
        app.get('/newKeyPair', (req, res) => {
            res.send(chain.getNewKeyPair())
        });

        // this suggests the node to produce a block and submit it
        app.get('/mineBlock', (req, res) => {
            var data = tempTxs.sort(function(a,b){return b.ts-a.ts})
            tempTxs = []
            res.sendStatus(200)
            var newBlock = chain.prepareNextBlock(data);
            // at this point our database is unrevertable
            chain.addBlock(newBlock, function(wasAdded) {
                if (!wasAdded) {
                    return
                }
                p2p.broadcast({type: 'new_block', data: newBlock});
                console.log('block #'+newBlock._id+': '+data.length+' tx(s) mined by '+newBlock.minedBy);
            })
        });

        // add data to the upcoming transactions pool
        app.post('/transact', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            chain.isValidTx(tx, function(isValid) {
                if (!isValid) {
                    console.log('Invalid tx', tx)
                    res.sendStatus(500)
                } else {
                    tempTxs.push(tx)
                    res.sendStatus(200);
                }
            })
        });

        // list connected peers
        app.get('/peers', (req, res) => {
            res.send(p2p.sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });
        
        // connect to a new peer
        app.post('/addPeer', (req, res) => {
            p2p.connect([req.body.peer]);
            res.send();
        });

        // look at the miner schedule
        app.get('/schedule', (req, res) => {
            res.send(schedule);
        });

        app.listen(http_port, () => console.log('Listening http on port: ' + http_port));
    }
}

module.exports = http