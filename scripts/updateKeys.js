const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')

function isValidPubKey(key) {
    try {
        return secp256k1.publicKeyVerify(bs58.decode(key))
    } catch (error) {
        return false
    }
}

var newKeys = [
    ['ynA1iY5xXooDUcDFUNPfbKwWmN8xuekN6An8Sydr2yrd', 'yuriitonkov'],
    ['ihWQ1jKM7Ma1ywrR9SkgaC8i1HoUsAqaiiBz2f7vu5p9', 'sames'],
    ['rgwSktkow9YPQg8dN5cd4G1Q7ybiGJyPeJ3CEiy3jsHj', 'mamun123456'],
    ['vtQVBSsyRwju5Cau6kkcL8tHfXjqXDgZ4PMMkT7T1eBN', 'saifulshahid'],
    ['ma1bwi1QpZDwFAUUoUR4V7xVQMNMKE4V6tamPkAMuZ47', 'toufiqurrahman32'],
    ['kxJqqbNzuXNzNMJTXfSYEQ2F8tPNfwZUXnyFTGnDwyG3', 'c-dan'],
    ['gNHkZYWA5qJSYuM6yHdj3E1vKwUFQG6d8dinuzgqV5Mr', 'dfacademy'],
    ['26LfozYxo8nXSMBTq8VhBrXePu8vq8iQ3z4RYazM91inM', 'horpey'],
    ['dmdbij4PLTcS2EbWNgw3zzWVBfPEPJPi7LazKqvP3rBn', 'johnspalding'],
    ['25gRCsUcUrBdyB1M8ygRezWC6frpznPgQc4Rj2dNSqiFu', 'mariita52'],
    ['27NPoGnXN6PKHTujL3M9yB2AUy49qNzUEinAMhKQh57bY', 'drutter'],
    ['onmgar8h5nGTtnhxHWsKFikM4eihXr9WQpkmTCHK7mBe', 'urme33'],
    ['piLWD35EGvF8e9go2XxJKJhqmm2hJHYKqcP7ZpmDi3La', 'engineermabbas'],
    ['eJYUC2SN2ZvC5iwvFg9QsenHn1XW7wArumXwo81FMiZo', 'pengeldi'],
    ['sd2Y9drx49mQ2ZuRsg2jDJDzAqzrxYLVxb3CWoshfKdX', 'tissot'],
    ['2ACibRZvCq2QPVx54gFMRAV9W3xJfJ7V2qG3nyN1xj8i2', 'kingscrown'],
    ['gFRgGDxa47UTY8a76eSV65hoDj4As853JR3U5iohUHM8', '@olivia08'],
    ['kR77izaw6jjbgbTyc4HbRAhY6zWTbb5wgucnwEzyyEAL', 'valiozzi'],
    ['21Kes7MqTeGXQvxRsEt3muGo8ojPiFKBR2Za1gPfS8T4W', 'lupe56'],
    ['gFRgGDxa47UTY8a76eSV65hoDj4As853JR3U5iohUHM8', 'olivia08'],
    ['zEsf2axhFuJuKNMT7DZznDo5bkr4U5bKVwfPbaYFWYoB', 'originalmrspice'],
    ['zgpgCRf4KMAfTJuPTbQFXVQVHBPdMpgBaaQ8MiQ3S5mM', 'aniita'],
    ['fF9XDqDTnZ2km6eMjV33rQSrh13z9xYwAkjkfUwiPJJp', 'steemer-sayu907'],
    ['u8LbcERU2shEjyn7RndU2CzpaJ5VR2HW4siBz9G2FC8V', 'paulmoon410'],
    ['vuwA2ZkKGo6dwZiELKgDLNRc6Y3Z2j7MRNzud5HakNXo', 'heidi71'],
    ['cSWsENW2LyQjW4cvEJvoJ3jmJaNUpGkp6bvjHxme8KyT', 'cryptoxicate'],
    ['266dj5oSjFCakDEeQWQx7qkFHCn1iKP26rPgUUWTrpa6M', 'drakernoise'],
    ['2BfirS5sSWeMKwUm5v9cadjZ7KbX2fkEREBpM4p8rGh1U', 'dronemania'],
    ['2BBYkB2HrREGvbx54smkPkPdnZS2drX1tsecx7yQKNkz4', 'krazzytrukker'],
    ['yHWdunZUNqgmRxxuXy2YYEqBoxaepKRiNNFfQVAaw5hK', 'entertainment42'],
    ['phPL13NQf9QZScrAZ6sJ1cP17zm1k6rwt7V69cBd5gXH', 'songsing19'],
    ['xvxTsRHyyekqfWiMbmZQo3CYvL3ZCpVgLjyHXb94xHvW', 'buzzer11'],
    ['27PyM2gXzgDDkf12WJtRcKnHPCPyF5fDxGfVdC8k9baC5', 'ionomy'],
    ['2A2No4SzEG1k3YyKnQ2CBtrDXoMmeSqsfjs6AvDVMV8TA', 'alive'],
    ['25PUPatrzr5Hf4sQd58VjedHfpSWum6asWQgsFfyK14xy', 'owl']
]

for (let i = 0; i < newKeys.length; i++) {
    if (!isValidPubKey(newKeys[i][0]))
        throw newKeys[i][0]
    else
        console.log(newKeys[i][1]+' key is valid')
}

// Connection URL
const url = 'mongodb://localhost:27017';
 
// Database Name
const dbName = 'avalon2';
 
// Use connect method to connect to the server
MongoClient.connect(url, {useUnifiedTopology: true}, function(err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");
    
    db = client.db(dbName);

    console.log('Updating '+newKeys.length)
    for (let i = 0; i < newKeys.length; i++) {
        updateOneKey(newKeys[i])
    }
 
//   client.close();
});

function updateOneKey(newKey) {
    var username = newKey[1].replace('@','').toLowerCase().trim()
    db.collection('accounts').updateOne({name: username}, {$set: {pub: newKey[0]}}, function(err, res) {
        if (!res.matchedCount)
            console.log(username+' didnt match')
        if (err) throw err;
    })
}