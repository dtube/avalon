var http_port = process.env.HTTP_PORT || 3001;
var express = require("express");
var bodyParser = require('body-parser');
const series = require('run-series')
const transaction = require('./transaction.js')

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
            res.sendStatus(200)
            chain.mineBlock(function(error, finalBlock) {
                if (error)
                    console.log('ERROR refused block', finalBlock)
            })
        });

        // add data to the upcoming transactions pool
        app.post('/transact', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            transaction.isValid(tx, new Date().getTime(), function(isValid) {
                p2p.broadcast({t:5, d:tx})
                if (!isValid) {
                    console.log('Invalid tx', tx)
                    res.sendStatus(500)
                } else {
                    transaction.addToPool([tx])
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
            res.send(chain.schedule);
        });

        // get new contents
        app.get('/new', (req, res) => {
            db.collection('contents').find({}, {sort: {_id: -1}}).toArray(function(err, contents) {
                res.send(contents)
                console.log(err, contents)
            })
        })

        app.listen(http_port, () => console.log('Listening http on port: ' + http_port));
    }
}

module.exports = http