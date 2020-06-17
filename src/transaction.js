var GrowInt = require('growint')
var CryptoJS = require('crypto-js')
const cloneDeep = require('clone-deep')

var Transaction = require('./transactions')
var TransactionType = Transaction.Types

transaction = {
    pool: [], // the pool holds temporary txs that havent been published on chain yet
    addToPool: (txs) => {
        for (let y = 0; y < txs.length; y++) {
            var exists = false
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash)
                    exists = true
            
            if (!exists)
                transaction.pool.push(txs[y])
        }
        
    },
    removeFromPool: (txs) => {
        for (let y = 0; y < txs.length; y++)
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash) {
                    transaction.pool.splice(i, 1)
                    break
                }
    },
    isInPool: (tx) => {
        var isInPool = false
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
        if (!tx.signature || typeof tx.signature !== 'string') {
            cb(false, 'invalid tx signature'); return
        }
        // enforce transaction limits
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 1) {
            cb(false, 'transaction type is disabled'); return
        }
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 2
            && tx.sender !== config.masterName) {
            cb(false, 'only "'+config.masterName+'" can execute this transaction type'); return
        }
        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > config.txExpirationTime) {
            cb(false, 'invalid timestamp'); return
        }
        // check if this tx hash was already added to chain recently
        if (transaction.isPublished(tx)) {
            cb(false, 'transaction already in chain'); return
        }
        // verify hash matches the transaction's payload
        var newTx = cloneDeep(tx)
        delete newTx.signature
        delete newTx.hash
        if (CryptoJS.SHA256(JSON.stringify(newTx)).toString() !== tx.hash) {
            cb(false, 'invalid tx hash does not match'); return
        }
        // checking transaction signature
        chain.isValidSignature(tx.sender, tx.type, tx.hash, tx.signature, function(legitUser) {
            if (!legitUser) {
                cb(false, 'invalid signature'); return
            }
            if (!legitUser.bw) {
                cb(false, 'user has no bandwidth object'); return
            }

            var newBw = new GrowInt(legitUser.bw, {growth:legitUser.balance/(config.bwGrowth), max:config.bwMax}).grow(ts)

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
    hasEnoughVT: (amount, ts, legitUser) => {
        // checking if user has enough power for a transaction requiring voting power
        var vtGrowConfig = {
            growth: legitUser.balance / config.vtGrowth,
            max: legitUser.maxVt
        }
        var vtBefore = new GrowInt(legitUser.vt, vtGrowConfig).grow(ts)
        if (vtBefore.v < Math.abs(amount))
            return false
        return true
    },
    collectGrowInts: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            // collect bandwidth
            var bandwidth = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth), max:config.bwMax})
            var needed_bytes = JSON.stringify(tx).length
            var bw = bandwidth.grow(ts)
            if (!bw) 
                throw 'No bandwidth error'
            
            bw.v -= needed_bytes
            if (tx.type === TransactionType.TRANSFER_BW)
                bw.v -= tx.data.amount

            // collect voting power when needed
            var vt = null
            var vtGrowConfig = {
                growth: account.balance / config.vtGrowth,
                max: account.maxVt
            }

            switch (tx.type) {
            case TransactionType.COMMENT:
            case TransactionType.VOTE:
            case TransactionType.PROMOTED_COMMENT:
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

            // update both at the same time !
            var changes = {bw: bw}
            if (vt) changes.vt = vt
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
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the balance changes (transfer, monetary distribution)
        // account.balance is the one before the change (!)
        if (!account.bw || !account.vt) 
            logr.debug('error loading grow int', account)
        
        var bw = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth), max:config.bwMax}).grow(ts)
        var vt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
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
        if (!acc.approves || acc.approves.length === 0 || !newCoins) {
            cb(true)
            return
        }

        var node_appr_before = Math.floor(acc.balance/acc.approves.length)
        acc.balance += newCoins
        var node_appr = Math.floor(acc.balance/acc.approves.length)
        
        var node_owners = []
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