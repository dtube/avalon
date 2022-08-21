const GrowInt = require('growint')
const CryptoJS = require('crypto-js')
const { EventEmitter } = require('events')
const cloneDeep = require('clone-deep')
const bson = require('bson')
const Transaction = require('./transactions')
const TransactionType = Transaction.Types
const max_mempool = process.env.MEMPOOL_SIZE || 2000

// probably due to non standard utf8 characters that were not properly written to mongodb/bson file
// for now we skip them until such bug can be reproduced
const skiphash = {
    '7dedc07cb42c96b5013710161bf487a2488fce789b80286e3df910075f98a4d1': '16de2c5c847962f3683aec852072e702fb8c4ffd81c3d23cf85b8d2da031bd8e' // tx in block 14,874,851
}

let transaction = {
    pool: [], // the pool holds temporary txs that havent been published on chain yet
    eventConfirmation: new EventEmitter(),
    addToPool: (txs) => {
        if (transaction.isPoolFull())
            return

        for (let y = 0; y < txs.length; y++) {
            let exists = false
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash)
                    exists = true
            
            if (!exists)
                transaction.pool.push(txs[y])
        }
        
    },
    isPoolFull: () => {
        if (transaction.pool.length >= max_mempool) {
            logr.warn('Mempool is full ('+transaction.pool.length+'/'+max_mempool+' txs), ignoring tx')
            return true
        }
        return false
    },
    removeFromPool: (txs) => {
        for (let y = 0; y < txs.length; y++)
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash) {
                    transaction.pool.splice(i, 1)
                    break
                }
    },
    cleanPool: () => {
        for (let i = 0; i < transaction.pool.length; i++)
            if (transaction.pool[i].ts + config.txExpirationTime < new Date().getTime()) {
                transaction.pool.splice(i,1)
                i--
            }
    },
    isInPool: (tx) => {
        let isInPool = false
        for (let i = 0; i < transaction.pool.length; i++)
            if (transaction.pool[i].hash === tx.hash) {
                isInPool = true
                break
            }
        return isInPool
    },
    isPublished: (tx) => {
        if (!tx.hash) return
        if (chain.recentTxs[tx.hash])
            return true
        return false
    },
    isValid: (tx, ts, cb) => {
        if (!tx) {
            cb(false, 'no transaction'); return
        }
        // checking required variables one by one
        
        if (!validate.integer(tx.type, true, false)) {
            cb(false, 'invalid tx type'); return
        }
        if (!tx.data || typeof tx.data !== 'object') {
            cb(false, 'invalid tx data'); return
        }
        if (!validate.string(tx.sender, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx sender'); return
        }
        if (!validate.integer(tx.ts, false, false)) {
            cb(false, 'invalid tx ts'); return
        }
        if (!tx.hash || typeof tx.hash !== 'string') {
            cb(false, 'invalid tx hash'); return
        }
        if (!tx.signature || (typeof tx.signature !== 'string' && !(config.multisig && Array.isArray(tx.signature)))) {
            cb(false, 'invalid tx signature'); return
        }
        // multisig transactions check
        // signatures in multisig txs contain an array of signatures and recid 
        if (config.multisig && Array.isArray(tx.signature))
            for (let s = 0; s < tx.signature.length; s++)
                if (!Array.isArray(tx.signature[s]) || tx.signature[s].length !== 2 || typeof tx.signature[s][0] !== 'string' || !Number.isInteger(tx.signature[s][1]))
                    return cb(false, 'invalid multisig tx signature #'+s)

        // enforce transaction limits
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 1) {
            cb(false, 'transaction type is disabled'); return
        }
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 2
            && tx.sender !== config.masterName) {
            cb(false, 'only "'+config.masterName+'" can execute this transaction type'); return
        }
        if (config.masterDao && tx.sender === config.masterName && !config.masterDaoTxs.includes(tx.type))
            return cb(false, 'master dao account cannot transact with type '+tx.type)
        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > config.txExpirationTime) {
            cb(false, 'invalid timestamp'); return
        }
        // enforce maximum transaction expiration
        if (tx.ts - ts > config.txExpirationMax)
            return cb(false, 'timestamp expiration exceeds max limit of '+config.txExpirationMax+'ms')
        // check if this tx hash was already added to chain recently
        if (transaction.isPublished(tx)) {
            cb(false, 'transaction already in chain'); return
        }
        // verify hash matches the transaction's payload
        let newTx = cloneDeep(tx)
        delete newTx.signature
        delete newTx.hash
        let computedHash = CryptoJS.SHA256(JSON.stringify(newTx)).toString()
        if (computedHash !== tx.hash && (skiphash[tx.hash] !== computedHash || (!p2p.recovering && chain.getLatestBlock()._id > chain.restoredBlocks))) {
            cb(false, 'invalid tx hash does not match'); return
        }
        // ensure nothing gets lost when serialized in bson
        // skipped during replays or rebuilds
        if (!p2p.recovering && chain.getLatestBlock()._id > chain.restoredBlocks && Transaction.transactions[tx.type].bsonValidate) {
            let bsonified = bson.deserialize(bson.serialize(newTx))
            let bsonifiedHash = CryptoJS.SHA256(JSON.stringify(bsonified)).toString()
            if (computedHash !== bsonifiedHash)
                return cb(false, 'unserializable transaction, perhaps due to non-utf8 character?')
        }
        // checking transaction signature
        chain.isValidSignature(tx.sender, tx.type, tx.hash, tx.signature, function(legitUser,e) {
            if (!legitUser) {
                cb(false, e || 'invalid signature'); return
            }
            if (!legitUser.bw) {
                cb(false, 'user has no bandwidth object'); return
            }

            let newBw = new GrowInt(legitUser.bw, {
                growth: Math.max(legitUser.baseBwGrowth || 0, legitUser.balance)/(config.bwGrowth),
                max: config.bwMax
            }).grow(ts)

            if (!newBw) {
                logr.debug(legitUser)
                cb(false, 'error debug'); return
            }

            // checking if the user has enough bandwidth
            if (JSON.stringify(tx).length > newBw.v && tx.sender !== config.masterName) {
                cb(false, 'need more bandwidth ('+(JSON.stringify(tx).length-newBw.v)+' B)'); return
            }

            // check transaction specifics
            transaction.isValidTxData(tx, ts, legitUser, function(isValid, error) {
                cb(isValid, error)
            })
        })
    },
    isValidTxData: (tx, ts, legitUser, cb) => {
        Transaction.validate(tx, ts, legitUser, function(err, res) {
            cb(err, res)
        })
    },
    notEnoughVP: (amount, ts, legitUser) => {
        // checking if user has enough power for a transaction requiring voting power
        let vtGrowConfig = {
            growth: legitUser.balance / config.vtGrowth,
            max: legitUser.maxVt
        }
        let vtBefore = new GrowInt(legitUser.vt, vtGrowConfig).grow(ts)
        return {
            has: vtBefore.v,
            needs: Math.max(Math.abs(amount) - vtBefore.v,0)
        }
    },
    collectGrowInts: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            // collect bandwidth
            let bandwidth = new GrowInt(account.bw, {
                growth: Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth),
                max: config.bwMax
            })
            let needed_bytes = JSON.stringify(tx).length
            let bw = bandwidth.grow(ts)
            if (!bw) 
                throw 'No bandwidth error'
            
            bw.v -= needed_bytes
            if (tx.type === TransactionType.TRANSFER_BW)
                bw.v -= tx.data.amount
            else if (tx.type === TransactionType.NEW_ACCOUNT_WITH_BW)
                bw.v -= tx.data.bw

            // collect voting power when needed
            let vt = null
            let vtGrowConfig = {
                growth: account.balance / config.vtGrowth,
                max: account.maxVt
            }

            switch (tx.type) {
            case TransactionType.COMMENT:
            case TransactionType.VOTE:
            case TransactionType.PROMOTED_COMMENT:
            case TransactionType.TIPPED_VOTE:
                if (tx.type === TransactionType.TIPPED_VOTE && !config.hotfix1) break
                vt = new GrowInt(account.vt, vtGrowConfig).grow(ts)
                vt.v -= Math.abs(tx.data.vt)
                break
            case TransactionType.TRANSFER_VT:
                vt = new GrowInt(account.vt, vtGrowConfig).grow(ts)
                vt.v -= tx.data.amount
                break
            case TransactionType.LIMIT_VT:
                vt = new GrowInt(account.vt, vtGrowConfig).grow(ts)
                break
            default:
                break
            }

            // update vote lock for proposals
            let newLock = 0
            let activeProposalVotes = []
            if (account.voteLock)
                for (let v in account.proposalVotes)
                    if (account.proposalVotes[v].end > ts) {
                        if (account.proposalVotes[v].amount - account.proposalVotes[v].bonus > newLock)
                            newLock = account.proposalVotes[v].amount - account.proposalVotes[v].bonus
                        activeProposalVotes.push(account.proposalVotes[v])
                    }

            // update all at the same time !
            let changes = {bw: bw}
            if (vt) changes.vt = vt
            if (account.voteLock) {
                if (account.voteLock !== newLock)
                    changes.voteLock = newLock
                if (account.proposalVotes.length !== activeProposalVotes.length)
                    changes.proposalVotes = activeProposalVotes
            }
            logr.trace('GrowInt Collect', account.name, changes)
            cache.updateOne('accounts', 
                {name: account.name},
                {$set: changes},
                function(err) {
                    if (err) throw err
                    cb(true)
                })
        })
    },
    execute: (tx, ts, cb) => {
        transaction.collectGrowInts(tx, ts, function(success) {
            if (!success) throw 'Error collecting bandwidth'
            Transaction.execute(tx, ts, function(executed, distributed, burned) {
                cb(executed, distributed, burned)
            })
        })
    },
    updateIntsAndNodeApprPromise: (account, ts, change) => {
        return new Promise((rs) => {
            transaction.updateGrowInts(account,ts,() => transaction.adjustNodeAppr(account,change,() => rs(true)))
        })
    },
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the balance changes (transfer, monetary distribution)
        // account.balance is the one before the change (!)
        if (!account.bw || !account.vt) 
            logr.debug('error loading grow int', account)
        
        let bw = new GrowInt(account.bw, {
            growth: Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth),
            max: config.bwMax
        }).grow(ts)
        let vt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
        if (!bw || !vt) {
            logr.fatal('error growing grow int', account, ts)
            return
        }
        logr.trace('GrowInt Update', account.name, bw, vt)
        cache.updateOne('accounts', 
            {name: account.name},
            {$set: {
                bw: bw,
                vt: vt
            }},
            function(err) {
                if (err) throw err
                cb(true)
            })
    },
    adjustNodeAppr: (acc, newCoins, cb) => {
        // updates the node_appr values for the node owners the account approves (when balance changes)
        // account.balance is the one before the change (!)
        // account object may skip cloneDeep operation
        if (!acc.approves || acc.approves.length === 0 || !newCoins) {
            cb(true)
            return
        }

        let node_appr_before = Math.floor(acc.balance/acc.approves.length)
        let node_appr = Math.floor((acc.balance+newCoins)/acc.approves.length)
        
        let node_owners = []
        for (let i = 0; i < acc.approves.length; i++)
            node_owners.push(acc.approves[i])
        
        logr.trace('NodeAppr Update', acc.name, newCoins, node_appr-node_appr_before, node_owners.length)
        cache.updateMany('accounts', 
            {name: {$in: node_owners}},
            {$inc: {node_appr: node_appr-node_appr_before}}
            , function(err) {
                if (err) throw err
                cb(true)
            })
    }
}

module.exports = transaction