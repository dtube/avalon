var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const series = require('run-series')
const transaction = require('./transaction.js')
const eco = require('./economics.js')
const notifications = require('./notifications.js')

class Block {
    constructor(index, phash, timestamp, txs, miner, missedBy, dist, burn, signature, hash) {
        this._id = index
        this.phash = phash.toString()
        this.timestamp = timestamp
        this.txs = txs
        this.miner = miner
        if (missedBy) this.missedBy = missedBy
        if (dist) this.dist = dist
        if (burn) this.burn = burn
        this.hash = hash
        this.signature = signature
    }
}

chain = {
    schedule: null,
    recentBlocks: [],
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
            config.masterName,
            null,
            null,
            null,
            "0000000000000000000000000000000000000000000000000000000000000000",
            config.originHash
        );
    },
    prepareBlock: () => {
        var previousBlock = chain.getLatestBlock()
        var nextIndex = previousBlock._id + 1
        var nextTimestamp = new Date().getTime()
        // grab all transactions and sort by ts
        var txs = transaction.pool.sort(function(a,b){return a.ts-b.ts})
        var miner = process.env.NODE_OWNER
        return new Block(nextIndex, previousBlock.hash, nextTimestamp, txs, miner);
    },
    hashAndSignBlock: (block) => {
        var nextHash = chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.distributed, block.burned);
        var signature = secp256k1.sign(new Buffer(nextHash, "hex"), bs58.decode(process.env.NODE_OWNER_PRIV));
        signature = bs58.encode(signature.signature)
        return new Block(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.distributed, block.burned, signature, nextHash);
        
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

            chain.executeBlock(newBlock, function(validTxs, distributed, burned) {
                // only add the valid transactions into the block
                newBlock.txs = validTxs

                if (distributed) newBlock.distributed = distributed
                if (burned) newBlock.burned = burned

                // remove all transactions from the pool (invalid ones too)
                transaction.pool = []

                // always record the failure of others
                if (chain.schedule.shuffle[(newBlock._id-1)%20].name != process.env.NODE_OWNER)
                    newBlock.missedBy = chain.schedule.shuffle[(newBlock._id-1)%20].name

                // hash and sign the block with our private key
                newBlock = chain.hashAndSignBlock(newBlock)
                
                // add it to our chain !
                chain.addBlock(newBlock, function(added) {
                    // and broadcast to peers
                    p2p.broadcastBlock(newBlock)

                    // process notifications (non blocking)
                    notifications.processBlock(newBlock)
                    cb(null, newBlock)
                })
            })
        })
    },
    validateAndAddBlock: (newBlock, cb) => {
        // when we receive an outside block and check whether we should add it to our chain or not
        if (chain.shuttingDown) return;
        chain.isValidNewBlock(newBlock, true, function(isValid) {
            if (!isValid) {
                logr.error('Invalid block')
                cb(true, newBlock); return
            }
                
            chain.executeBlock(newBlock, function(validTxs, distributed, burned) {
                // if any transaction is wrong, thats an error before this should be a legit block 100% of the time
                if (newBlock.txs.length != validTxs.length) {
                    logr.error('Invalid tx(s) in block')
                    cb(true, newBlock); return
                }

                // error if distributed or burned computed amounts are different than the reported one
                var blockDist = newBlock.dist || 0
                if (blockDist != distributed) {
                    logr.error('Wrong dist amount', blockDist, distributed)
                    cb(true, newBlock); return
                }
                var blockBurn = newBlock.burn || 0
                if (blockBurn != burned) {
                    logr.error('Wrong burn amount', blockBurn, burned)
                    cb(true, newBlock); return
                }

                // remove all transactions from this block from our transaction pool
                transaction.removeFromPool(newBlock.txs)

                chain.addBlock(newBlock, function(added) {
                    // and broadcast to peers
                    p2p.broadcastBlock(newBlock)
                    cb(null, newBlock)
                })
            })

            
        })
    },
    minerWorker: (block) => {
        if (p2p.recovering) return;
        // if we are the next miner or backup miner, prepare to mine
        clearTimeout(chain.worker)
        if (block.miner == process.env.NODE_OWNER || chain.schedule.shuffle[(block._id)%20].name == process.env.NODE_OWNER) {
            var mineInMs = config.blockTime
            if (chain.schedule.shuffle[(block._id)%20].name != process.env.NODE_OWNER)
                mineInMs += config.blockTime
            chain.worker = setTimeout(function(){
                chain.mineBlock(function(error, finalBlock) {
                    if (error)
                        logr.warn('miner worker trying to mine but couldnt', finalBlock)
                })
            }, mineInMs)
        }
    },
    addBlock: (block, cb) => {
        eco.nextBlock()
        // add the block in our own db
        db.collection('blocks').insertOne(block, function(err) {
            if (err) throw err;
            // push cached accounts and contents to mongodb
            cache.writeToDisk(function() {
                // if block id is mult of 20, reschedule next 20 blocks
                if (block._id%20 == 0) {
                    chain.minerSchedule(block, function(minerSchedule) {
                        chain.schedule = minerSchedule
                        chain.recentBlocks.push(block)
                        chain.minerWorker(block)
                        chain.output(block)
                        cb(true)
                    })
                } else {
                    chain.recentBlocks.push(block)
                    chain.minerWorker(block)
                    chain.output(block)
                    cb(true)
                }
            })
        });
    },
    output: (block) => {
        var output = 'block #'+block._id+': '+block.txs.length+' tx(s) mined by '+block.miner
        if (block.missedBy)
            output += ' missed by '+block.missedBy
        if (block.dist)
            output += ' dist: '+block.dist
        if (block.burn)
            output += ' burn: '+block.burn
        logr.info(output)
    },
    isValidPubKey: (key) => {
        try {
            return secp256k1.publicKeyVerify(bs58.decode(key))
        } catch (error) {
            return false
        }
    },
    isValidSignature: (user, txType, hash, sign, cb) => {
        // verify signature and bandwidth
        cache.findOne('accounts', {name: user}, function(err, account) {
            if (err) throw err;
            if (!account) {
                cb(false); return
            }
            // main key can authorize all transactions
            var allowedPubKeys = [account.pub]
            // add all secondary keys having this transaction type as allowed keys
            if (account.keys && txType) {
                for (let i = 0; i < account.keys.length; i++) {
                    if (account.keys[i].types.indexOf(txType) > -1)
                        allowedPubKeys.push(account.keys[i].pub)
                }
            }

            for (let i = 0; i < allowedPubKeys.length; i++) {
                if (secp256k1.verify(
                new Buffer(hash, "hex"),
                bs58.decode(sign),
                bs58.decode(allowedPubKeys[i]))) {
                    cb(account)
                    return
                }
            }
            cb(false)
        })
    },
    isValidNewBlock: (newBlock, verifyHashAndSignature, cb) => {
        // verify all block fields one by one
        if (!newBlock._id || typeof newBlock._id !== "number") {
            logr.debug('invalid block _id')
            cb(false); return
        }
        if (!newBlock.phash || typeof newBlock.phash !== "string") {
            logr.debug('invalid block phash')
            cb(false); return
        }
        if (!newBlock.timestamp || typeof newBlock.timestamp !== "number") {
            logr.debug('invalid block timestamp')
            cb(false); return
        }
        if (!newBlock.txs || typeof newBlock.txs !== "object" || !Array.isArray(newBlock.txs)) {
            logr.debug('invalid block txs')
            cb(false); return
        }
        if (!newBlock.miner || typeof newBlock.miner !== "string") {
            logr.debug('invalid block miner')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.hash || typeof newBlock.hash !== "string")) {
            logr.debug('invalid block hash')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.signature || typeof newBlock.signature !== "string")) {
            logr.debug('invalid block signature')
            cb(false); return
        }
        if (newBlock.missedBy && typeof newBlock.missedBy !== "string") {
            logr.debug('invalid block missedBy')
        }   

        // verify that its indeed the next block
        var previousBlock = chain.getLatestBlock()
        if (previousBlock._id + 1 !== newBlock._id) {
            logr.debug('invalid index')
            cb(false); return
        }
        // from the same chain
        if (previousBlock.hash !== newBlock.phash) {
            logr.debug('invalid phash')
            cb(false); return
        }

        // check if miner isnt trying to fast forward time
        // this might need to be tuned in the future to allow for network delay / clocks desync / etc
        // added 200ms
        if (newBlock.timestamp > new Date().getTime() + 200) {
            logr.debug('timestamp from the future', newBlock.timestamp, new Date().getTime())
            cb(false); return
        }

        // check if new block isnt too early
        if (newBlock.timestamp - previousBlock.timestamp < config.blockTime) {
            logr.debug('block too early')
            cb(false); return
        }

        // check if miner is scheduled
        var isMinerAuthorized = false;
        if (chain.schedule.shuffle[(newBlock._id-1)%20].name == newBlock.miner) {
            isMinerAuthorized = true;
        } else if (newBlock.miner == previousBlock.miner) {
            // allow the previous miner to mine again if current miner misses the block
            if (newBlock.timestamp - previousBlock.timestamp < 6000) {
                logr.debug('block too early for backup miner', newBlock.timestamp - previousBlock.timestamp)
                cb(false); return
            } else {
                isMinerAuthorized = true;
            }
        }
        if (!isMinerAuthorized) {
            logr.debug('unauthorized miner')
            cb(false); return
        }

        if (!verifyHashAndSignature) {
            cb(true); return
        }

        // and that the hash is correct
        var theoreticalHash = chain.calculateHashForBlock(newBlock)
        if (theoreticalHash !== newBlock.hash) {
            logr.debug(typeof (newBlock.hash) + ' ' + typeof theoreticalHash)
            logr.debug('invalid hash: ' + theoreticalHash + ' ' + newBlock.hash)
            cb(false); return
        }

        // finally, verify the signature of the miner
        chain.isValidSignature(newBlock.miner, null, newBlock.hash, newBlock.signature, function(legitUser) {
            if (!legitUser) {
                logr.debug('invalid miner signature')
                cb(false); return
            }

            cb(true)
        })
    },
    executeBlock: (block, cb) => {
        var executions = []
        for (let i = 0; i < block.txs.length; i++) {
            executions.push(function(callback) {
                var tx = block.txs[i]
                transaction.isValid(tx, block.timestamp, function(isValid) {
                    if (isValid) {
                        transaction.execute(tx, block.timestamp, function(executed, distributed, burned) {
                            if (!executed)
                                logr.fatal('Tx execution failure', tx)
                            callback(null, {
                                executed: executed,
                                distributed: distributed,
                                burned: burned
                            })
                        })
                    } else {
                        logr.error('Invalid transaction', tx)
                        callback(null, false)
                    }
                })
                i++
            })
        }
        var i = 0
        //var timeBefore = new Date().getTime()
        series(executions, function(err, results) {
            //logr.debug('Block executed in '+(new Date().getTime()-timeBefore)+'ms')
            if (err) throw err;
            var executedSuccesfully = []
            var distributedInBlock = 0
            var burnedInBlock = 0
            for (let i = 0; i < results.length; i++) {
                if (results[i].executed)
                    executedSuccesfully.push(block.txs[i])
                if (results[i].distributed)
                    distributedInBlock += results[i].distributed
                if (results[i].burned)
                    burnedInBlock += results[i].burned
            }
                
            cb(executedSuccesfully, distributedInBlock, burnedInBlock)
        })
    },
    minerSchedule: (block, cb) => {
        var hash = block.hash
        var rand = parseInt("0x"+hash.substr(hash.length-6))
        logr.info('Generating schedule... NRNG: ' + rand)
        chain.generateTop20Miner(function(miners) {
            miners = miners.sort(function(a,b) {
                if(a.name < b.name) return -1;
                if(a.name > b.name) return 1;
                return 0;
            })
            var shuffledMiners = []
            while (miners.length > 0) {
                var i = rand%miners.length
                shuffledMiners.push(miners[i])
                miners.splice(i, 1)
            }
            
            var i = 0;
            while (shuffledMiners.length < 20) {
                shuffledMiners.push(shuffledMiners[i])
                i++
            }

            cb({
                block: block,
                shuffle: shuffledMiners
            })
        })
    },
    generateTop20Miner: (cb) => {
        db.collection('accounts').find({node_appr: {$gt: 0}}, {
            sort: {node_appr: -1},
            limit: 20
        }).toArray(function(err, accounts) {
            if (err) throw err;
            cb(accounts)
        })
    },
    calculateHashForBlock: (block) => {
        return chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.dist, block.burn);
    },
    calculateHash: (index, phash, timestamp, txs, miner, missedBy, distributed, burned) => {
        var string = index + phash + timestamp + txs + miner
        if (missedBy) string += missedBy
        if (distributed) string += distributed
        if (burned) string += burned

        return CryptoJS.SHA256(string).toString();
    },    
    getLatestBlock: () => {
        return chain.recentBlocks[chain.recentBlocks.length-1]
    },    
    getFirstMemoryBlock: () => {
        return chain.recentBlocks[0]
    }
}

module.exports = chain