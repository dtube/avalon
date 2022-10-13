const CryptoJS = require('crypto-js')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const series = require('run-series')
const cloneDeep = require('clone-deep')
const dao = require('./dao')
const daoMaster = require('./daoMaster')
const transaction = require('./transaction.js')
const notifications = require('./notifications.js')
const txHistory = require('./txHistory')
const blocks = require('./blocks')
const GrowInt = require('growint')
const default_replay_output = 100
const replay_output = process.env.REPLAY_OUTPUT || default_replay_output
const max_batch_blocks = 10000

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

let chain = {
    blocksToRebuild: [],
    restoredBlocks: 0,
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
        let previousBlock = chain.getLatestBlock()
        let nextIndex = previousBlock._id + 1
        let nextTimestamp = new Date().getTime()
        // grab all transactions and sort by ts
        let txs = []
        let mempool = transaction.pool.sort(function(a,b){return a.ts-b.ts})
        loopOne:
        for (let i = 0; i < mempool.length; i++) {
            if (txs.length === config.maxTxPerBlock)
                break
            for (let y = 0; y < txs.length; y++)
                if (txs[y].sender === mempool[i].sender)
                    continue loopOne
            txs.push(mempool[i])
        }

        loopTwo:
        for (let i = 0; i < mempool.length; i++) {
            if (txs.length === config.maxTxPerBlock)
                break
            for (let y = 0; y < txs.length; y++)
                if (txs[y].hash === mempool[i].hash)
                    continue loopTwo
            txs.push(mempool[i])
        }
        txs = txs.sort(function(a,b){return a.ts-b.ts})
        transaction.removeFromPool(txs)
        return new Block(nextIndex, previousBlock.hash, nextTimestamp, txs, process.env.NODE_OWNER)
    },
    hashAndSignBlock: (block) => {
        let nextHash = chain.calculateHashForBlock(block)
        let signature = secp256k1.ecdsaSign(Buffer.from(nextHash, 'hex'), bs58.decode(process.env.NODE_OWNER_PRIV))
        signature = bs58.encode(signature.signature)
        return new Block(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.dist, block.burn, signature, nextHash)
    },
    canMineBlock: (cb) => {
        if (chain.shuttingDown) {
            cb(true, null); return
        }
        let newBlock = chain.prepareBlock()
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
            chain.executeBlockTransactions(newBlock, true, function(validTxs, distributed, burned) {
                cache.rollback()
                dao.resetID()
                daoMaster.resetID()
                // and only add the valid txs to the new block
                newBlock.txs = validTxs

                // always record the failure of others
                if (chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name !== process.env.NODE_OWNER)
                    newBlock.missedBy = chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name

                if (distributed) newBlock.dist = distributed
                if (burned) newBlock.burn = burned

                // hash and sign the block with our private key
                newBlock = chain.hashAndSignBlock(newBlock)
                
                // push the new block to consensus possible blocks
                // and go straight to end of round 0 to skip re-validating the block
                let possBlock = {
                    block: newBlock
                }
                for (let r = 0; r < config.consensusRounds; r++)
                    possBlock[r] = []

                logr.debug('Mined a new block, proposing to consensus')

                possBlock[0].push(process.env.NODE_OWNER)
                consensus.possBlocks.push(possBlock)
                consensus.endRound(0, newBlock)
                cb(null, newBlock)
            })
        })
    },
    validateAndAddBlock: (newBlock, revalidate, cb) => {
        // when we receive an outside block and check whether we should add it to our chain or not
        if (chain.shuttingDown) return
        chain.isValidNewBlock(newBlock, revalidate, false, function(isValid) {
            if (!isValid) {
                return cb(true, newBlock)
            }
            // straight execution
            chain.executeBlockTransactions(newBlock, revalidate, function(validTxs, distributed, burned) {
                // if any transaction is wrong, thats a fatal error
                if (newBlock.txs.length !== validTxs.length) {
                    logr.error('Invalid tx(s) in block')
                    cb(true, newBlock); return
                }

                // error if distributed or burned computed amounts are different than the reported one
                let blockDist = newBlock.dist || 0
                if (blockDist !== distributed) {
                    logr.error('Wrong dist amount', blockDist, distributed)
                    cb(true, newBlock); return
                }
                let blockBurn = newBlock.burn || 0
                if (blockBurn !== burned) {
                    logr.error('Wrong burn amount', blockBurn, burned)
                    cb(true, newBlock); return
                }

                // add txs to recents
                chain.addRecentTxsInBlock(newBlock.txs)

                // remove all transactions from this block from our transaction pool
                transaction.removeFromPool(newBlock.txs)

                chain.addBlock(newBlock, function() {
                    // and broadcast to peers (if not replaying)
                    if (!p2p.recovering)
                        p2p.broadcastBlock(newBlock)

                    // process notifications and leader stats (non blocking)
                    notifications.processBlock(newBlock)

                    // emit event to confirm new transactions in the http api
                    if (!p2p.recovering)
                        for (let i = 0; i < newBlock.txs.length; i++)
                            transaction.eventConfirmation.emit(newBlock.txs[i].hash)

                    cb(null, newBlock)
                })
            })
        })
    },
    addRecentTxsInBlock: (txs = []) => {
        for (let t in txs)
            chain.recentTxs[txs[t].hash] = txs[t]
    },
    minerWorker: (block) => {
        if (p2p.recovering) return
        clearTimeout(chain.worker)

        if (chain.schedule.shuffle.length === 0) {
            logr.fatal('All leaders gave up their stake? Chain is over')
            process.exit(1)
        }

        let mineInMs = null
        // if we are the next scheduled witness, try to mine in time
        if (chain.schedule.shuffle[(block._id)%config.leaders].name === process.env.NODE_OWNER)
            mineInMs = config.blockTime
        // else if the scheduled leaders miss blocks
        // backups witnesses are available after each block time intervals
        else for (let i = 1; i < 2*config.leaders; i++)
            if (chain.recentBlocks[chain.recentBlocks.length - i]
            && chain.recentBlocks[chain.recentBlocks.length - i].miner === process.env.NODE_OWNER) {
                mineInMs = (i+1)*config.blockTime
                break
            }

        if (mineInMs) {
            mineInMs -= (new Date().getTime()-block.timestamp)
            mineInMs += 20
            logr.debug('Trying to mine in '+mineInMs+'ms')
            consensus.observer = false
            if (mineInMs < config.blockTime/2) {
                logr.warn('Slow performance detected, will not try to mine next block')
                return
            }
            chain.worker = setTimeout(function(){
                chain.mineBlock(function(error, finalBlock) {
                    if (error)
                        logr.warn('miner worker trying to mine but couldnt', finalBlock)
                })
            }, mineInMs)
        }
            
    },
    addBlock: async (block, cb) => {
        // add the block in our own db
        if (blocks.isOpen)
            blocks.appendBlock(block)
        else
            await db.collection('blocks').insertOne(block)

        // push cached accounts and contents to mongodb
        chain.cleanMemory()

        // update the config if an update was scheduled
        config = require('./config.js').read(block._id)
        chain.applyHardforkPostBlock(block._id)
        eco.appendHistory(block)
        eco.nextBlock()
        dao.nextBlock()
        daoMaster.nextBlock()
        leaderStats.processBlock(block)
        txHistory.processBlock(block)

        // if block id is mult of n leaders, reschedule next n blocks
        if (block._id % config.leaders === 0)
            chain.schedule = chain.minerSchedule(block)
        chain.recentBlocks.push(block)
        chain.minerWorker(block)
        chain.output(block)
        cache.writeToDisk(false)
        cb(true)
    },
    output: (block,rebuilding) => {
        chain.nextOutput.txs += block.txs.length
        if (block.dist)
            chain.nextOutput.dist += block.dist
        if (block.burn)
            chain.nextOutput.burn += block.burn

        if (block._id%replay_output === 0 || (!rebuilding && !p2p.recovering)) {
            let currentOutTime = new Date().getTime()
            let output = ''
            if (rebuilding)
                output += 'Rebuilt '

            output += '#'+block._id

            if (rebuilding)
                output += '/' + chain.restoredBlocks
            else
                output += '  by '+block.miner

            output += '  '+chain.nextOutput.txs+' tx'
            if (chain.nextOutput.txs>1)
                output += 's'

            output += '  dist: '+eco.round(chain.nextOutput.dist)
            output += '  burn: '+eco.round(chain.nextOutput.burn)
            output += '  delay: '+ (currentOutTime - block.timestamp)

            if (block.missedBy && !rebuilding)
                output += '  MISS: '+block.missedBy
            else if (rebuilding) {
                output += '  Performance: ' + Math.floor(replay_output/(currentOutTime-chain.lastRebuildOutput)*1000) + 'b/s'
                chain.lastRebuildOutput = currentOutTime
            }

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
    lastRebuildOutput: 0,
    isValidPubKey: (key) => {
        try {
            return secp256k1.publicKeyVerify(bs58.decode(key))
        } catch (error) {
            return false
        }
    },
    isValidSignature: (user, txType, hash, sign, cb) => {
        // verify signature and bandwidth
        cache.findOne('accounts', {name: user}, async function(err, account) {
            if (err) throw err
            if (!account) {
                cb(false); return
            } else if (chain.restoredBlocks && chain.getLatestBlock()._id < chain.restoredBlocks && process.env.REBUILD_NO_VERIFY === '1')
                // no verify rebuild mode, only use if you trust the contents of blocks.zip
                return cb(account)

            // main key can authorize all transactions
            let allowedPubKeys = [[account.pub, account.pub_weight || 1]]
            let threshold = 1
            // add all secondary keys having this transaction type as allowed keys
            if (account.keys && typeof txType === 'number' && Number.isInteger(txType))
                for (let i = 0; i < account.keys.length; i++) 
                    if (account.keys[i].types.indexOf(txType) > -1)
                        allowedPubKeys.push([account.keys[i].pub, account.keys[i].weight || 1])
            // account authorities
            if (account.auths && typeof txType === 'number' && Number.isInteger(txType))
                for (let i in account.auths)
                    if (account.auths[i].types.indexOf(txType) > -1) {
                        let authorizedAcc = await cache.findOnePromise('accounts',{name: account.auths[i].user})
                        if (authorizedAcc && authorizedAcc.keys)
                            for (let a in authorizedAcc.keys)
                                if (authorizedAcc.keys[a].id === account.auths[i].id) {
                                    allowedPubKeys.push([authorizedAcc.keys[a].pub, account.auths[i].weight || 1])
                                    break
                                }
                    }

            // if there is no transaction type
            // it means we are verifying a block signature
            // so only the leader key is allowed
            if (txType === null)
                if (account.pub_leader)
                    allowedPubKeys = [[account.pub_leader, 1]]
                else
                    allowedPubKeys = []
            // compute required signature threshold otherwise
            else if (account.thresholds && account.thresholds[txType])
                threshold = account.thresholds[txType]
            else if (account.thresholds && account.thresholds.default)
                threshold = account.thresholds.default

            // multisig transactions
            if (config.multisig && Array.isArray(sign))
                return chain.isValidMultisig(account,threshold,allowedPubKeys,hash,sign,cb)
            
            // single signature
            try {
                for (let i = 0; i < allowedPubKeys.length; i++) {
                    let bufferHash = Buffer.from(hash, 'hex')
                    let b58sign = bs58.decode(sign)
                    let b58pub = bs58.decode(allowedPubKeys[i][0])
                    if (secp256k1.ecdsaVerify(b58sign, bufferHash, b58pub) && allowedPubKeys[i][1] >= threshold) {
                        cb(account)
                        return
                    }
                }
            } catch (e) {}
            cb(false)
        })
    },
    isValidMultisig: (account,threshold,allowedPubKeys,hash,signatures,cb) => {
        let validWeights = 0
        let validSigs = []
        try {
            let hashBuf = Buffer.from(hash, 'hex')
            for (let s = 0; s < signatures.length; s++) {
                let signBuf = bs58.decode(signatures[s][0])
                let recoveredPub = bs58.encode(secp256k1.ecdsaRecover(signBuf,signatures[s][1],hashBuf))
                if (validSigs.includes(recoveredPub))
                    return cb(false, 'duplicate signatures found')
                for (let p = 0; p < allowedPubKeys.length; p++)
                    if (allowedPubKeys[p][0] === recoveredPub) {
                        validWeights += allowedPubKeys[p][1]
                        validSigs.push(recoveredPub)
                    }
            }
        } catch (e) {
            return cb(false, 'invalid signatures: ' + e.toString())
        }
        if (validWeights >= threshold)
            cb(account)
        else
            cb(false, 'insufficient signature weight ' + validWeights + ' to reach threshold of ' + threshold)
    },
    isValidHashAndSignature: (newBlock, cb) => {
        // and that the hash is correct
        let theoreticalHash = chain.calculateHashForBlock(newBlock,true)
        if (theoreticalHash !== newBlock.hash) {
            logr.debug(typeof (newBlock.hash) + ' ' + typeof theoreticalHash)
            logr.error('invalid hash: ' + theoreticalHash + ' ' + newBlock.hash)
            cb(false); return
        }

        // finally, verify the signature of the miner
        chain.isValidSignature(newBlock.miner, null, newBlock.hash, newBlock.signature, function(legitUser) {
            if (!legitUser) {
                logr.error('invalid miner signature')
                cb(false); return
            }
            cb(true)
        })
    },
    isValidBlockTxs: (newBlock, cb) => {
        chain.executeBlockTransactions(newBlock, true, function(validTxs, dist, burn) {
            cache.rollback()
            dao.resetID()
            daoMaster.resetID()
            if (validTxs.length !== newBlock.txs.length) {
                logr.error('invalid block transaction')
                cb(false); return
            }
            let blockDist = newBlock.dist || 0
            if (blockDist !== dist) {
                logr.error('Wrong dist amount',blockDist,dist)
                return cb(false)
            }

            let blockBurn = newBlock.burn || 0
            if (blockBurn !== burn) {
                logr.error('Wrong burn amount',blockBurn,burn)
                return cb(false)
            }
            cb(true)
        })
    },
    isValidNewBlock: (newBlock, verifyHashAndSignature, verifyTxValidity, cb) => {
        if (!newBlock) return
        // verify all block fields one by one
        if (!newBlock._id || typeof newBlock._id !== 'number') {
            logr.error('invalid block _id')
            cb(false); return
        }
        if (!newBlock.phash || typeof newBlock.phash !== 'string') {
            logr.error('invalid block phash')
            cb(false); return
        }
        if (!newBlock.timestamp || typeof newBlock.timestamp !== 'number') {
            logr.error('invalid block timestamp')
            cb(false); return
        }
        if (!newBlock.txs || typeof newBlock.txs !== 'object' || !Array.isArray(newBlock.txs)) {
            logr.error('invalid block txs')
            cb(false); return
        }
        if (newBlock.txs.length > config.maxTxPerBlock) {
            logr.error('invalid block too many txs')
            cb(false); return
        }
        if (!newBlock.miner || typeof newBlock.miner !== 'string') {
            logr.error('invalid block miner')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.hash || typeof newBlock.hash !== 'string')) {
            logr.error('invalid block hash')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.signature || typeof newBlock.signature !== 'string')) {
            logr.error('invalid block signature')
            cb(false); return
        }
        if (newBlock.missedBy && typeof newBlock.missedBy !== 'string') 
            logr.error('invalid block missedBy')
           

        // verify that its indeed the next block
        let previousBlock = chain.getLatestBlock()
        if (previousBlock._id + 1 !== newBlock._id) {
            logr.error('invalid index')
            cb(false); return
        }
        // from the same chain
        if (previousBlock.hash !== newBlock.phash) {
            logr.error('invalid phash')
            cb(false); return
        }

        // check if miner isnt trying to fast forward time
        // this might need to be tuned in the future to allow for network delay / clocks desync / etc
        if (newBlock.timestamp > new Date().getTime() + config.maxDrift) {
            logr.error('timestamp from the future', newBlock.timestamp, new Date().getTime())
            cb(false); return
        }

        // check if miner is normal scheduled one
        let minerPriority = 0
        if (chain.schedule.shuffle[(newBlock._id-1)%config.leaders].name === newBlock.miner) 
            minerPriority = 1
        // allow miners of n blocks away
        // to mine after (n+1)*blockTime as 'backups'
        // so that the network can keep going even if 1,2,3...n node(s) have issues
        else
            for (let i = 1; i <= config.leaders; i++) {
                if (!chain.recentBlocks[chain.recentBlocks.length - i])
                    break
                if (chain.recentBlocks[chain.recentBlocks.length - i].miner === newBlock.miner) {
                    minerPriority = i+1
                    break
                }
            }
                

        if (minerPriority === 0) {
            logr.error('unauthorized miner')
            cb(false); return
        }

        // check if new block isnt too early
        if (newBlock.timestamp - previousBlock.timestamp < minerPriority*config.blockTime) {
            logr.error('block too early for miner with priority #'+minerPriority)
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
    isValidNewBlockPromise: (newBlock, verifyHashAndSig, verifyTxValidity) => new Promise((rs) => chain.isValidNewBlock(newBlock, verifyHashAndSig, verifyTxValidity, rs)),
    executeBlockTransactions: (block, revalidate, cb) => {
        // revalidating transactions in orders if revalidate = true
        // adding transaction to recent transactions (to prevent tx re-use) if isFinal = true
        let executions = []
        for (let i = 0; i < block.txs.length; i++) 
            executions.push(function(callback) {
                let tx = block.txs[i]
                if (revalidate)
                    transaction.isValid(tx, block.timestamp, function(isValid, error) {
                        if (isValid) 
                            transaction.execute(tx, block.timestamp, function(executed, distributed, burned) {
                                if (!executed) {
                                    logr.fatal('Tx execution failure', tx)
                                    process.exit(1)
                                }
                                callback(null, {
                                    executed: executed,
                                    distributed: distributed,
                                    burned: burned
                                })
                            })
                        else {
                            logr.error(error, tx)
                            callback(null, false)
                        }
                    })
                else
                    transaction.execute(tx, block.timestamp, function(executed, distributed, burned) {
                        if (!executed)
                            logr.fatal('Tx execution failure', tx)
                        callback(null, {
                            executed: executed,
                            distributed: distributed,
                            burned: burned
                        })
                    })
                i++
            })
        executions.push((callback) => chain.applyHardfork(block,callback))
        
        let blockTimeBefore = new Date().getTime()
        series(executions, async function(err, results) {
            let string = 'executed'
            if(revalidate) string = 'validated & '+string
            logr.debug('Block '+string+' in '+(new Date().getTime()-blockTimeBefore)+'ms')
            if (err) throw err
            let executedSuccesfully = []
            let distributedInBlock = 0
            let burnedInBlock = 0
            for (let i = 0; i < results.length; i++) {
                if (results[i].executed)
                    executedSuccesfully.push(block.txs[i])
                if (results[i].distributed)
                    distributedInBlock += results[i].distributed
                if (results[i].burned)
                    burnedInBlock += results[i].burned
            }

            // execute periodic burn
            let additionalBurn = await chain.decayBurnAccount(block)

            // execute dao triggers
            let daoBurn = await dao.runTriggers(block.timestamp)

            // add rewards for the leader who mined this block
            chain.leaderRewards(block.miner, block.timestamp, function(dist) {
                distributedInBlock += dist
                distributedInBlock = Math.round(distributedInBlock*1000) / 1000
                burnedInBlock += additionalBurn
                burnedInBlock += daoBurn
                burnedInBlock = Math.round(burnedInBlock*1000) / 1000
                cb(executedSuccesfully, distributedInBlock, burnedInBlock)
            })
        })
    },
    minerSchedule: (block) => {
        let hash = block.hash
        let rand = parseInt('0x'+hash.substr(hash.length-config.leaderShufflePrecision))
        if (!p2p.recovering)
            logr.debug('Generating schedule... NRNG: ' + rand)
        let miners = chain.generateLeaders(true, false, config.leaders, 0)
        miners = miners.sort(function(a,b) {
            if(a.name < b.name) return -1
            if(a.name > b.name) return 1
            return 0
        })
        let shuffledMiners = []
        while (miners.length > 0) {
            let i = rand%miners.length
            shuffledMiners.push(miners[i])
            miners.splice(i, 1)
        }
        
        let y = 0
        while (shuffledMiners.length < config.leaders) {
            shuffledMiners.push(shuffledMiners[y])
            y++
        }

        return {
            block: block,
            shuffle: shuffledMiners
        }
    },
    generateLeaders: (withLeaderPub, withWs, limit, start) => {
        let leaders = []
        let leaderAccs = withLeaderPub ? cache.leaders : cache.accounts
        for (const key in leaderAccs) {
            if (!cache.accounts[key].node_appr || cache.accounts[key].node_appr <= 0)
                continue
            if (withLeaderPub && !cache.accounts[key].pub_leader)
                continue
            let leader = cache.accounts[key]
            let leaderDetails = {
                name: leader.name,
                pub: leader.pub,
                pub_leader: leader.pub_leader,
                balance: leader.balance,
                approves: leader.approves,
                node_appr: leader.node_appr,
            }
            if (withWs && leader.json && leader.json.node && typeof leader.json.node.ws === 'string')
                leaderDetails.ws = leader.json.node.ws
            leaders.push(leaderDetails)
        }
        leaders = leaders.sort(function(a,b) {
            return b.node_appr - a.node_appr
        })
        return leaders.slice(start, limit)
    },
    leaderRewards: (name, ts, cb) => {
        // rewards leaders with 'free' voting power in the network
        cache.findOne('accounts', {name: name}, function(err, account) {
            let newBalance = account.balance + config.leaderReward
            let newVt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
            let newBw = new GrowInt(account.bw, {
                growth: Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth),
                max: config.bwMax
            }).grow(ts)
            if (!newVt || !newBw) 
                logr.debug('error growing grow int', account, ts)
            
            if (config.leaderRewardVT)
                newVt.v += config.leaderRewardVT

            if (config.leaderReward > 0 || config.leaderRewardVT > 0)
                cache.updateOne('accounts', 
                    {name: account.name},
                    {$set: {
                        vt: newVt,
                        bw: newBw,
                        balance: newBalance
                    }},
                    function(err) {
                        if (err) throw err
                        if (config.leaderReward > 0)
                            transaction.adjustNodeAppr(account, config.leaderReward, function() {
                                cb(config.leaderReward)
                            })
                        else
                            cb(0)
                    }
                )
            else cb(0)
        },true)
    },
    decayBurnAccount: (block) => {
        return new Promise((rs) => {
            if (!config.burnAccount || config.burnAccountIsBlackhole || block._id % config.ecoBlocks !== 0)
                return rs(0)
            // offset inflation
            let rp = eco.rewardPool()
            let burnAmount = Math.floor(rp.dist)
            if (burnAmount <= 0)
                return rs(0)
            cache.findOne('accounts', {name: config.burnAccount}, (e,burnAccount) => {
                // do nothing if there is none to burn
                if (burnAccount.balance <= 0)
                    return rs(0)
                // burn only up to available balance
                burnAmount = Math.min(burnAmount,burnAccount.balance)
                cache.updateOne('accounts', {name: config.burnAccount}, {$inc: {balance: -burnAmount}},() =>
                    transaction.updateGrowInts(burnAccount, block.timestamp, () => {
                        transaction.adjustNodeAppr(burnAccount, -burnAmount, () => {
                            logr.econ('Burned ' + burnAmount + ' periodically from ' + config.burnAccount)
                            return rs(burnAmount)
                        })
                    })
                )
            })
        })
    },
    calculateHashForBlock: (block,deleteExisting) => {
        if (config.blockHashSerialization === 1)
            return chain.calculateHashV1(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, block.dist, block.burn)
        else if (config.blockHashSerialization === 2) {
            let clonedBlock
            if (deleteExisting) {
                clonedBlock = cloneDeep(block)
                delete clonedBlock.hash
                delete clonedBlock.signature
            }
            return CryptoJS.SHA256(JSON.stringify(deleteExisting ? clonedBlock : block)).toString()
        }
    },
    calculateHashV1: (index, phash, timestamp, txs, miner, missedBy, distributed, burned) => {
        let string = index + phash + timestamp + txs + miner
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
        eco.cleanHistory()
    },
    cleanMemoryBlocks: () => {
        if (config.ecoBlocksIncreasesSoon) {
            logr.trace('Keeping old blocks in memory because ecoBlocks is changing soon')
            return
        }
            
        let extraBlocks = chain.recentBlocks.length - config.ecoBlocks
        while (extraBlocks > 0) {
            chain.recentBlocks.shift()
            extraBlocks--
        }
    },
    cleanMemoryTx: () => {
        for (const hash in chain.recentTxs)
            if (chain.recentTxs[hash].ts + config.txExpirationTime < chain.getLatestBlock().timestamp)
                delete chain.recentTxs[hash]
    },
    applyHardfork: (block,cb) => {
        // Do something on hardfork block after tx executions and before leader rewards distribution
        // As this is not a real transaction, no actual transaction is considered executed here
        if (block._id === 17150000)
            // Clear @dtube.airdrop account
            cache.findOne('accounts', {name: config.burnAccount}, (e,burnAccount) => {
                let burned = burnAccount.balance
                cache.updateOne('accounts',
                    {name: config.burnAccount},
                    {$set: {
                        balance: 0,
                        bw: { v: 0, t: block.timestamp },
                        vt: { v: 0, t: block.timestamp }
                    }}, () => cb(null, { executed: false, distributed: 0, burned: burned })
                )
            })
        else
            cb(null, { executed: false, distributed: 0, burned: 0 })
    },
    applyHardforkPostBlock: (blockNum) => {
        // Do something after executing hardfork block
        if (blockNum === 4860000)
            eco.loadHistory() // reset previous votes
    },
    batchLoadBlocks: (blockNum,cb) => {
        if (chain.blocksToRebuild.length === 0)
            if (blocks.isOpen) {
                chain.blocksToRebuild = blocks.readRange(blockNum, blockNum+max_batch_blocks-1)
                cb(chain.blocksToRebuild.shift())
            } else
                db.collection('blocks').find({_id: { $gte: blockNum, $lt: blockNum+max_batch_blocks }}).toArray((e,loadedBlocks) => {
                    if (e) throw e
                    if (loadedBlocks) chain.blocksToRebuild = loadedBlocks
                    cb(chain.blocksToRebuild.shift())
                })
        else cb(chain.blocksToRebuild.shift())
    },
    rebuildState: (blockNum,cb) => {
        // If chain shutting down, stop rebuilding and output last number for resuming
        if (chain.shuttingDown)
            return cb(null,blockNum)
            
        // Genesis block is handled differently
        if (blockNum === 0) {
            eco.history = [{_id: 0, votes: 0, cDist: 0, cBurn: 0}]
            chain.recentBlocks = [chain.getGenesisBlock()]
            chain.schedule = chain.minerSchedule(chain.getGenesisBlock())
            chain.rebuildState(blockNum+1,cb)
            return
        }

        chain.batchLoadBlocks(blockNum, async (blockToRebuild) => {
            if (!blockToRebuild)
                // Rebuild is complete
                return cb(null,blockNum)
            
            // Validate block and transactions, then execute them
            if (process.env.REBUILD_NO_VALIDATE !== '1') {
                let isValidBlock = await chain.isValidNewBlockPromise(blockToRebuild,true,false)
                if (!isValidBlock)
                    return cb(true, blockNum)
            }
            chain.executeBlockTransactions(blockToRebuild,process.env.REBUILD_NO_VALIDATE !== '1',(validTxs,dist,burn) => {
                // if any transaction is wrong, thats a fatal error
                // transactions should have been verified in isValidNewBlock
                if (blockToRebuild.txs.length !== validTxs.length) {
                    logr.fatal('Invalid tx(s) in block found after starting execution')
                    return cb('Invalid tx(s) in block found after starting execution', blockNum)
                }

                // error if distributed or burned computed amounts are different than the reported one
                let blockDist = blockToRebuild.dist || 0
                if (blockDist !== dist)
                    return cb('Wrong dist amount ' + blockDist + ' ' + dist, blockNum)

                let blockBurn = blockToRebuild.burn || 0
                if (blockBurn !== burn) 
                    return cb('Wrong burn amount ' + blockBurn + ' ' + burn, blockNum)
                
                // update the config if an update was scheduled
                chain.addRecentTxsInBlock(blockToRebuild.txs)
                config = require('./config.js').read(blockToRebuild._id)
                chain.applyHardforkPostBlock(blockToRebuild._id)
                dao.nextBlock()
                daoMaster.nextBlock()
                eco.nextBlock()
                eco.appendHistory(blockToRebuild)
                chain.cleanMemory()
                leaderStats.processBlock(blockToRebuild)
                txHistory.processBlock(blockToRebuild)

                let writeInterval = parseInt(process.env.REBUILD_WRITE_INTERVAL)
                if (isNaN(writeInterval) || writeInterval < 1)
                    writeInterval = 10000

                cache.processRebuildOps(() => {
                    if (blockToRebuild._id % config.leaders === 0)
                        chain.schedule = chain.minerSchedule(blockToRebuild)
                    chain.recentBlocks.push(blockToRebuild)
                    chain.output(blockToRebuild, true)
                    
                    // process notifications and leader stats (non blocking)
                    notifications.processBlock(blockToRebuild)

                    // next block
                    chain.rebuildState(blockNum+1, cb)
                }, blockToRebuild._id % writeInterval === 0)
            })
        })
    }
}

module.exports = chain
