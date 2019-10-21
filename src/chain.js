var CryptoJS = require('crypto-js')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const series = require('run-series')
const transaction = require('./transaction.js')
const notifications = require('./notifications.js')
var GrowInt = require('growint')
var default_replay_output = 100
var replay_output = process.env.REPLAY_OUTPUT || default_replay_output

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
    recentTxs: {},
    getNewKeyPair: () => {
        let privKey, pubKey
        do {
            privKey = randomBytes(config.randomBytesLength)
            pubKey = secp256k1.publicKeyCreate(privKey)
        } while (!secp256k1.privateKeyVerify(privKey))
    
        return {
            pub: bs58.encode(pubKey),        
            priv: bs58.encode(privKey)
        }
    },
    getGenesisBlock: () => {
        return new Block(
            0,
            '0',
            0,
            [],
            config.masterName,
            null,
            null,
            null,
            '0000000000000000000000000000000000000000000000000000000000000000',
            config.originHash
        )
    },
    prepareBlock: () => {
        var previousBlock = chain.getLatestBlock()
        var nextIndex = previousBlock._id + 1
        var nextTimestamp = new Date().getTime()
        // grab all transactions and sort by ts
        var txs = transaction.pool.sort(function(a,b){return a.ts-b.ts})
        var miner = process.env.NODE_OWNER
        return new Block(nextIndex, previousBlock.hash, nextTimestamp, txs, miner)
    },
    hashAndSignBlock: (block) => {
        var nextHash = chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.distributed, block.burned)
        var signature = secp256k1.sign(Buffer.from(nextHash, 'hex'), bs58.decode(process.env.NODE_OWNER_PRIV))
        signature = bs58.encode(signature.signature)
        return new Block(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.distributed, block.burned, signature, nextHash)
        
    },
    canMineBlock: (cb) => {
        if (chain.shuttingDown) {
            cb(true, null); return
        }
        var newBlock = chain.prepareBlock()
        // run the transactions and validation
        // pre-validate our own block (not the hash and signature as we dont have them yet)
        // nor transactions because we will filter them on execution later
        chain.isValidNewBlock(newBlock, false, false, function(isValid) {
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

            // at this point transactions in the pool seem all validated
            // BUT with a different ts and without checking for double spend
            // so we will execute transactions in order and revalidate after each execution
            chain.executeBlockTransactions(newBlock, true, true, function(validTxs, distributed, burned) {
                // and only add the valid txs to the new block
                newBlock.txs = validTxs

                if (distributed) newBlock.distributed = distributed
                if (burned) newBlock.burned = burned

                // remove all transactions from the pool (invalid ones too)
                transaction.pool = []

                // always record the failure of others
                if (chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name !== process.env.NODE_OWNER)
                    newBlock.missedBy = chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name

                // hash and sign the block with our private key
                newBlock = chain.hashAndSignBlock(newBlock)
                
                // TODO maybe only precommit to consensus here
                // add it to our chain !
                chain.addBlock(newBlock, function() {
                    // and broadcast to peers
                    p2p.broadcastBlock(newBlock)

                    // process notifications (non blocking)
                    notifications.processBlock(newBlock)
                    cb(null, newBlock)
                })
            })
        })
    },
    validateAndAddBlock: (newBlock, revalidate, cb) => {
        // when we receive an outside block and check whether we should add it to our chain or not
        if (chain.shuttingDown) return
        chain.isValidNewBlock(newBlock, revalidate, revalidate, function(isValid) {
            if (!isValid) {
                logr.error('Invalid block')
                cb(true, newBlock); return
            }
            // straight execution
            chain.executeBlockTransactions(newBlock, false, true, function(validTxs, distributed, burned) {
                // if any transaction is wrong, thats a fatal error
                // transactions should have been verified in isValidNewBlock
                if (newBlock.txs.length !== validTxs.length) {
                    logr.fatal('Invalid tx(s) in block found after starting execution')
                    cb(true, newBlock); return
                }

                // error if distributed or burned computed amounts are different than the reported one
                var blockDist = newBlock.dist || 0
                if (blockDist !== distributed) {
                    logr.error('Wrong dist amount', blockDist, distributed)
                    cb(true, newBlock); return
                }
                var blockBurn = newBlock.burn || 0
                if (blockBurn !== burned) {
                    logr.error('Wrong burn amount', blockBurn, burned)
                    cb(true, newBlock); return
                }

                // remove all transactions from this block from our transaction pool
                transaction.removeFromPool(newBlock.txs)

                chain.addBlock(newBlock, function() {
                    // and broadcast to peers (if not replaying)
                    if (!p2p.recovering)
                        p2p.broadcastBlock(newBlock)

                    // process notifications (non blocking)
                    notifications.processBlock(newBlock)
                    cb(null, newBlock)
                })
            })

            
        })
    },
    minerWorker: (block) => {
        if (p2p.recovering) return
        clearTimeout(chain.worker)

        if (chain.schedule.shuffle.length === 0) {
            logr.fatal('All leaders gave up their stake? Chain is over')
            process.exit(1)
        }

        var mineInMs = null
        // if we are the next scheduled witness, try to mine in time
        if (chain.schedule.shuffle[(block._id)%config.leaders].name === process.env.NODE_OWNER)
            mineInMs = config.blockTime
        // else if the scheduled leaders miss blocks
        // backups witnesses are available after each block time intervals
        else for (let i = 1; i <= config.leaders; i++)
            if (chain.recentBlocks[chain.recentBlocks.length - i]
            && chain.recentBlocks[chain.recentBlocks.length - i].miner === process.env.NODE_OWNER) {
                mineInMs = (i+1)*config.blockTime
                break
            }

        if (mineInMs) {
            logr.trace('Trying to mine in '+mineInMs+'ms')
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
            if (err) throw err
            // push cached accounts and contents to mongodb
            cache.writeToDisk(function() {
                chain.cleanMemory()

                // update the config if an update was scheduled
                config = require('./config.js').read(block._id)
                
                // if block id is mult of n leaders, reschedule next n blocks
                if (block._id % config.leaders === 0) 
                    chain.minerSchedule(block, function(minerSchedule) {
                        chain.schedule = minerSchedule
                        chain.recentBlocks.push(block)
                        chain.minerWorker(block)
                        chain.output(block)
                        cb(true)
                    })
                else {
                    chain.recentBlocks.push(block)
                    chain.minerWorker(block)
                    chain.output(block)
                    cb(true)
                }
            })
        })
    },
    output: (block) => {
        chain.nextOutput.txs += block.txs.length
        if (block.dist)
            chain.nextOutput.dist += block.dist
        if (block.burn)
            chain.nextOutput.burn += block.burn

        if (!p2p.recovering || block._id%replay_output === 0) {
            var output = 'block #'+block._id+': '+chain.nextOutput.txs+' tx(s) mined by '+block.miner
            if (block.missedBy)
                output += ' missed by '+block.missedBy

            output += ' dist: '+chain.nextOutput.dist
            output += ' burn: '+chain.nextOutput.burn
            logr.info(output)
            chain.nextOutput = {
                txs: 0,
                dist: 0,
                burn: 0
            }
        }
            
    },
    nextOutput: {
        txs: 0,
        dist: 0,
        burn: 0
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
            if (err) throw err
            if (!account) {
                cb(false); return
            }
            // main key can authorize all transactions
            var allowedPubKeys = [account.pub]
            // add all secondary keys having this transaction type as allowed keys
            if (account.keys && typeof txType === 'number' && Number.isInteger(txType))
                for (let i = 0; i < account.keys.length; i++) 
                    if (account.keys[i].types.indexOf(txType) > -1)
                        allowedPubKeys.push(account.keys[i].pub)
                
            
            for (let i = 0; i < allowedPubKeys.length; i++) {
                var bufferHash = Buffer.from(hash, 'hex')
                var b58sign = bs58.decode(sign)
                var b58pub = bs58.decode(allowedPubKeys[i])
                if (secp256k1.verify(bufferHash, b58sign, b58pub)) {
                    cb(account)
                    return
                }
            }
            cb(false)
        })
    },
    isValidHashAndSignature: (newBlock, cb) => {
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
    isValidBlockTxs: (newBlock, cb) => {
        chain.executeBlockTransactions(newBlock, true, false, function(validTxs) {
            cache.rollback()
            if (validTxs.length !== newBlock.txs.length) {
                logr.debug('invalid block transaction')
                cb(false); return
            }
            cb(true)
        })
    },
    isValidNewBlock: (newBlock, verifyHashAndSignature, verifyTxValidity, cb) => {
        // verify all block fields one by one
        if (!newBlock._id || typeof newBlock._id !== 'number') {
            logr.debug('invalid block _id')
            cb(false); return
        }
        if (!newBlock.phash || typeof newBlock.phash !== 'string') {
            logr.debug('invalid block phash')
            cb(false); return
        }
        if (!newBlock.timestamp || typeof newBlock.timestamp !== 'number') {
            logr.debug('invalid block timestamp')
            cb(false); return
        }
        if (!newBlock.txs || typeof newBlock.txs !== 'object' || !Array.isArray(newBlock.txs)) {
            logr.debug('invalid block txs')
            cb(false); return
        }
        if (!newBlock.miner || typeof newBlock.miner !== 'string') {
            logr.debug('invalid block miner')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.hash || typeof newBlock.hash !== 'string')) {
            logr.debug('invalid block hash')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.signature || typeof newBlock.signature !== 'string')) {
            logr.debug('invalid block signature')
            cb(false); return
        }
        if (newBlock.missedBy && typeof newBlock.missedBy !== 'string') 
            logr.debug('invalid block missedBy')
           

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
        if (newBlock.timestamp > new Date().getTime() + config.maxDrift) {
            logr.debug('timestamp from the future', newBlock.timestamp, new Date().getTime())
            cb(false); return
        }

        // check if miner is normal scheduled one
        var minerPriority = 0
        if (chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name === newBlock.miner) 
            minerPriority = 1
        // allow miners of n blocks away
        // to mine after (n+1)*blockTime as 'backups'
        // so that the network can keep going even if 1,2,3...n node(s) have issues
        else
            for (let i = 1; i <= config.leaders; i++)
                if (chain.recentBlocks[chain.recentBlocks.length - i].miner === newBlock.miner) {
                    minerPriority = i+1
                    break
                }

        if (minerPriority === 0) {
            logr.debug('unauthorized miner')
            cb(false); return
        }

        // check if new block isnt too early
        if (newBlock.timestamp - previousBlock.timestamp < minerPriority*config.blockTime) {
            logr.debug('block too early for miner with priority #'+minerPriority)
            cb(false); return
        }

        if (!verifyTxValidity) {
            if (!verifyHashAndSignature) {
                cb(true); return
            }
            chain.isValidHashAndSignature(newBlock, function(isValid) {
                if (!isValid) {
                    cb(false); return
                }
                cb(true)
            })
        } else
            chain.isValidBlockTxs(newBlock, function(isValid) {
                if (!isValid) {
                    cb(false); return
                }
                if (!verifyHashAndSignature) {
                    cb(true); return
                }
                chain.isValidHashAndSignature(newBlock, function(isValid) {
                    if (!isValid) {
                        cb(false); return
                    }
                    cb(true)
                })
            })
    },
    executeBlockTransactions: (block, revalidate, isFinal, cb) => {
        // revalidating transactions in orders if revalidate = true
        // adding transaction to recent transactions (to prevent tx re-use) if isFinal = true
        var executions = []
        for (let i = 0; i < block.txs.length; i++) 
            executions.push(function(callback) {
                var tx = block.txs[i]
                if (revalidate)
                    transaction.isValid(tx, block.timestamp, function(isValid, error) {
                        if (isValid) 
                            transaction.execute(tx, block.timestamp, function(executed, distributed, burned) {
                                if (!executed) {
                                    logr.fatal('Tx execution failure', tx)
                                    process.exit(1)
                                }
                                if (isFinal)
                                    chain.recentTxs[tx.hash] = tx
                                callback(null, {
                                    executed: executed,
                                    distributed: distributed,
                                    burned: burned
                                })
                            })
                        else {
                            logr.debug(error, tx)
                            callback(null, false)
                        }
                    })
                else
                    transaction.execute(tx, block.timestamp, function(executed, distributed, burned) {
                        if (!executed)
                            logr.fatal('Tx execution failure', tx)
                        if (isFinal)
                            chain.recentTxs[tx.hash] = tx
                        callback(null, {
                            executed: executed,
                            distributed: distributed,
                            burned: burned
                        })
                    })
                i++
            })
        
        var blockTimeBefore = new Date().getTime()
        series(executions, function(err, results) {
            var string = 'executed'
            if(revalidate) string = 'validated & '+string
            logr.trace('Block '+string+' in '+(new Date().getTime()-blockTimeBefore)+'ms')
            if (err) throw err
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

            // add rewards for the leader who mined this block
            chain.leaderRewards(block.miner, block.timestamp, function(dist) {
                distributedInBlock += dist
                cb(executedSuccesfully, distributedInBlock, burnedInBlock)
            })
        })
    },
    minerSchedule: (block, cb) => {
        var hash = block.hash
        var rand = parseInt('0x'+hash.substr(hash.length-config.leaderShufflePrecision))
        if (!p2p.recovering)
            logr.info('Generating schedule... NRNG: ' + rand)
        chain.generateLeaders(function(miners) {
            miners = miners.sort(function(a,b) {
                if(a.name < b.name) return -1
                if(a.name > b.name) return 1
                return 0
            })
            var shuffledMiners = []
            while (miners.length > 0) {
                var i = rand%miners.length
                shuffledMiners.push(miners[i])
                miners.splice(i, 1)
            }
            
            var y = 0
            while (shuffledMiners.length < config.leaders) {
                shuffledMiners.push(shuffledMiners[y])
                y++
            }

            cb({
                block: block,
                shuffle: shuffledMiners
            })
        })
    },
    generateLeaders: (cb) => {
        db.collection('accounts').find({node_appr: {$gt: 0}}, {
            sort: {node_appr: -1, name: -1},
            limit: config.leaders
        }).toArray(function(err, accounts) {
            if (err) throw err
            cb(accounts)
        })
    },
    leaderRewards: (name, ts, cb) => {
        // rewards leaders with 'free' voting power in the network
        cache.findOne('accounts', {name: name}, function(err, account) {
            var newBalance = account.balance + config.leaderReward
            var newVt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
            if (!newVt) 
                logr.debug('error growing grow int', account, ts)
            
            newVt.v += config.leaderRewardVT

            if (config.leaderReward > 0 || config.leaderRewardVT > 0)
                cache.updateOne('accounts', 
                    {name: account.name},
                    {$set: {
                        vt: newVt,
                        balance: newBalance
                    }},
                    function(err) {
                        if (err) throw err
                        transaction.adjustNodeAppr(account, config.leaderReward, function() {
                            cb(config.leaderReward)
                        })
                    })
            else cb(0)
        })
    },
    calculateHashForBlock: (block) => {
        return chain.calculateHash(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.dist, block.burn)
    },
    calculateHash: (index, phash, timestamp, txs, miner, missedBy, distributed, burned) => {
        var string = index + phash + timestamp + txs + miner
        if (missedBy) string += missedBy
        if (distributed) string += distributed
        if (burned) string += burned

        return CryptoJS.SHA256(string).toString()
    },    
    getLatestBlock: () => {
        return chain.recentBlocks[chain.recentBlocks.length-1]
    },    
    getFirstMemoryBlock: () => {
        return chain.recentBlocks[0]
    },
    cleanMemory: () => {
        chain.cleanMemoryBlocks()
        chain.cleanMemoryTx()
    },
    cleanMemoryBlocks: () => {
        if (config.ecoBlocksIncreasesSoon) {
            logr.trace('Keeping old blocks in memory because ecoBlocks is changing soon')
            return
        }
            
        var extraBlocks = chain.recentBlocks.length - config.ecoBlocks
        while (extraBlocks > 0) {
            chain.recentBlocks.splice(0,1)
            extraBlocks--
        }
    },
    cleanMemoryTx: () => {
        for (const hash in chain.recentTxs) 
            if (chain.recentTxs[hash].ts + config.txExpirationTime < chain.getLatestBlock().ts)
                delete chain.recentTxs[hash]
        
    }
}

module.exports = chain