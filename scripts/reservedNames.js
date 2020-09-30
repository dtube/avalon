const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

var publicKey = '25hQu969FKTma1sVQH1dtvYqsdJKowKbTZzMpPsrwbvKM'
var reservedUsernames = [
    // potential scams
    'null',
    'undefined',
    'admin',
    'administrator',
    'mod',
    'moderator',
    'burn',
    // exchanges
    'binance',
    'huobi',
    'coinbase',
    'kraken',
    'upbit',
    'kucoin',
    'bitstamp',
    'poloniex',
    'bittrex',
    'bitfinex',
    'btcturk',
    'bithumb',
    'liquid',
    'coinex',
    'okex',
    'yobit',
    'mxc',
    'latoken',
    'probit',
    'uniswap',
    'gate.io',
    'ionomy',
    'gemini',
    'ftx',
    'bitmex',
    // staff accounts
    'green',
    'one',
    'god',
    'berk',
    'adrien',
    'greg',
    'alive',
    'owl'
]

// Connection URL
const url = 'mongodb://localhost:27017';
 
// Database Name
const dbName = 'avalon2';
 
// Use connect method to connect to the server
MongoClient.connect(url, {useUnifiedTopology: true}, function(err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");
    
    const db = client.db(dbName);

    console.log(reservedUsernames.length)
    for (let i = 0; i < reservedUsernames.length; i++) {
        console.log(reservedUsernames[i])
        var newUser = {
            name: reservedUsernames[i].toLowerCase(),
            pub: publicKey,
            balance: 0,
            bw: {v:0,t:0},
            vt: {v:0,t:0},
            follows: [],
            followers: [],
            keys: [],
            created: {
                by: 'dtube',
                ts: new Date().getTime()
            }
        }
        db.collection('accounts').insertOne(newUser, function(err, res) {
            if (err) throw err;
        })
    }
 
//   client.close();
});