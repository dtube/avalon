var CryptoJS = require("crypto-js");
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('bs58')
const series = require('run-series')
const transaction = require('./transaction.js')

class Block {
    constructor(index, phash, timestamp, txs, miner, signature, hash) {
        this._id = index;
        this.phash = phash.toString();
        this.timestamp = timestamp;
        this.txs = txs;
        this.miner = miner;
        this.hash = hash;
        this.signature = signature;
    }
}

chain = {
    getNewKeyPair: () => {
        const msg = randomBytes(32)
        let privKey, pubKey
        do {
            privKey = randomBytes(32)
            pubKey = secp256k1.publicKeyCreate(privKey)
        } while (!secp256k1.privateKeyVerify(privKey))
    
        return {
            pub: bs58.encode(pubKey),        
            priv: bs58.encode(privKey)
        }
    },
    getGenesisBlock: (data) => {
        return new Block(
            0,
            "0",
            0,
            [],
            "master",
            "0000000000000000000000000000000000000000000000000000000000000000",
            "0000000000000000000000000000000000000000000000000000000000000000"
        );
    },
    prepareBlock: () => {
        var previousBlock = chain.getLatestBlock()
        var nextIndex = previousBlock._id + 1
        var nextTimestamp = new Date().getTime()
        // grab all transactions and sort by ts
        var txs = tempTxs.sort(function(a,b){return a.ts-b.ts})
        var miner = process.env.NODE_OWNER
        return new Block(nextIndex, previousBlock.hash, nextTimestamp, txs, miner, null, null);
    },
    hashAndSignBlock: (block) => {
        var nextHash = chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner);
        var signature = secp256k1.sign(new Buffer(nextHash, "hex"), bs58.decode(process.env.NODE_OWNER_PRIV));
        signature = bs58.encode(signature.signature)
        return new Block(block._id, block.phash, block.timestamp, block.txs, block.miner, signature, nextHash);
        
    },
    canMineBlock: (cb) => {
        if (chain.shuttingDown) {
            cb(true, null); return
        }
        var newBlock = chain.prepareBlock()
        // run the transactions and validation
        // pre-validate our own block (not the hash and signature as we dont have them yet)
        chain.isValidNewBlock(newBlock, false, function(isValid) {
            if (!isValid) {
                cb(true, newBlock); return
            }
            cb(null, newBlock)
        })
    },
    mineBlock: (cb) => {
        if (chain.shuttingDown) return
        chain.canMineBlock(function(err, newBlock) {
            if (err) {
                cb(true, newBlock); return
            }
            chain.executeBlock(newBlock, function(validTxs) {
                // only add the valid transactions into the block
                newBlock.txs = validTxs
                tempTxs = []
                // hash and sign the block with our private key
                newBlock = chain.hashAndSignBlock(newBlock)
                
                // add it to our chain !
                chain.addBlock(newBlock, function(added) {
                    // and broadcast to peers
                    p2p.broadcastBlock(newBlock)
                    cb(null, newBlock)
                })
            })
        })
    },
    validateAndAddBlock: (newBlock, cb) => {
        if (chain.shuttingDown) return;
        chain.isValidNewBlock(newBlock, true, function(isValid) {
            if (!isValid) {
                cb(true, newBlock); return
            }
                
            chain.executeBlock(newBlock, function(validTxs) {
                if (newBlock.txs.length != validTxs.length) {
                    cb(true, newBlock); return
                }
                chain.addBlock(newBlock, function(added) {
                    // and broadcast to peers
                    p2p.broadcastBlock(newBlock)
                    cb(null, newBlock)
                })
            })

            
        })
    },
    addBlock: (block, cb) => {
        // add the block in our own db
        db.collection('blocks').insertOne(block, function(err) {
            if (err) throw err;
            tempBlocks.push(block)

            // if block id is mult of 20, reschedule next 20 blocks
            if (block._id%20 == 0) {
                chain.minerSchedule(block, function(minerSchedule) {
                    schedule = minerSchedule
                })
            }

            console.log('block #'+block._id+': '+block.txs.length+' tx(s) mined by '+block.miner);

            cb(true)
        });
    },
    isValidSignature: (user, hash, sign, cb) => {
        // verify signature and bandwidth
        db.collection('accounts').findOne({name: user}, function(err, account) {
            if (err) throw err;
            var minerPub = account.pub;
            if (secp256k1.verify(
                new Buffer(hash, "hex"),
                bs58.decode(sign),
                bs58.decode(minerPub)))
                cb(account)
            else
                cb(false)
        })
    },
    isValidNewBlock: (newBlock, verifyHashAndSignature, cb) => {
        // verify that its indeed the next block
        var previousBlock = chain.getLatestBlock()
        if (previousBlock._id + 1 !== newBlock._id) {
            console.log('invalid index')
            cb(false); return
        }
        // from the same chain
        if (previousBlock.hash !== newBlock.phash) {
            console.log('invalid phash')
            cb(false); return
        }

        // check if miner isnt trying to fast forward time
        // this might need to be tuned in the future to allow for network delay
        if (newBlock.timestamp > new Date().getTime()) {
            console.log('timestamp from the future')
            cb(false); return
        }

        // check if new block isnt too early
        if (newBlock.timestamp - previousBlock.timestamp < 3000) {
            console.log('block too early')
            cb(false); return
        }

        // check if miner is scheduled witness
        var isMinerAuthorized = false;
        if (schedule.shuffle[(newBlock._id-1)%20].name == newBlock.miner) {
            isMinerAuthorized = true;
        } else if (newBlock.miner == previousBlock.miner) {
            // allow the previous miner to mine again if current miner misses the block
            if (newBlock.timestamp - previousBlock.timestamp < 6000) {
                console.log('block too early for backup witness')
                cb(false); return
            } else {
                isMinerAuthorized = true;
                newBlock.missedBy = schedule.shuffle[(newBlock._id-1)%20].name
            }
        }
        if (!isMinerAuthorized) {
            console.log('unauthorized miner')
            cb(false); return
        }

        if (!verifyHashAndSignature) {
            cb(true); return
        }

        // and that the hash is correct
        var theoreticalHash = chain.calculateHashForBlock(newBlock)
        if (theoreticalHash !== newBlock.hash) {
            console.log(typeof (newBlock.hash) + ' ' + typeof theoreticalHash)
            console.log('invalid hash: ' + theoreticalHash + ' ' + newBlock.hash)
            cb(false); return
        }

        // finally, verify the signature of the miner
        chain.isValidSignature(newBlock.miner, newBlock.hash, newBlock.signature, function(legitUser) {
            if (!legitUser) {
                console.log('invalid miner signature')
                cb(false); return
            }

            cb(true)
        })
    },
    executeBlock: (block, cb) => {
        // count how many missed blocks by witnesses
        if (block.missedBy) {
            db.collection('accounts').updateOne(
                {name: block.missedBy},
                {$inc: {missedBlocks: 1}}
            )
        }

        var executions = []
        for (let i = 0; i < block.txs.length; i++) {
            executions.push(function(callback) {
                var tx = block.txs[i]
                transaction.isValid(tx, block.timestamp, function(isValid) {
                    if (isValid) {
                        transaction.execute(tx, block.timestamp, function(executed) {
                            if (!executed)
                                console.log('Non executed transaction')
                            callback(null, executed)
                        })
                    } else {
                        console.log('Invalid transaction', tx)
                        callback(null, false)
                    }
                })
                i++
            })
        }
        var i = 0
        series(executions, function(err, results) {
            if (err) throw err;
            var executedSuccesfully = []
            for (let i = 0; i < results.length; i++) {
                if (results[i] != true)
                    console.log('ERROR: non-executed tx', i, block.txs[i])
                else
                    executedSuccesfully.push(block.txs[i])
            }
                
            cb(executedSuccesfully)
        })
    },
    minerSchedule: (block, cb) => {
        var hash = block.hash
        console.log('Generating miners schedule ' + hash)
        var rand = parseInt("0x"+hash.substr(hash.length-6))
        chain.generateTop20Witness(function(miners) {
            var shuffledMiners = []
            while (miners.length > 0) {
                var i = rand%miners.length
                shuffledMiners.push(miners[i])
                miners.splice(i, 1)
            }
            
            var i = 0;
            while (shuffledMiners.length < 20) {
                shuffledMiners.push(shuffledMiners[0])
                i++
            }
            //console.log(shuffledMiners.map(m => m.name))
            cb({
                block: block,
                shuffle: shuffledMiners
            })
        })
    },
    generateTop20Witness: (cb) => {
        db.collection('accounts').find({node_appr: {$gt: 0}}, {
            sort: {node_appr: -1},
            limit: 20
        }).toArray(function(err, accounts) {
            if (err) throw err;
            cb(accounts)
        })
    },
    calculateHashForBlock: (block) => {
        return chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner);
    },
    calculateHash: (index, phash, timestamp, txs, miner) => {
        return CryptoJS.SHA256(index + phash + timestamp + txs + miner).toString();
    },    
    getLatestBlock: () => {
        return tempBlocks[tempBlocks.length-1]
    },    
    getFirstMemoryBlock: () => {
        return tempBlocks[0]
    }
}

module.exports = chain