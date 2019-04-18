var GrowInt = require('growint')

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
            cb(false, 'transaction type is master-only'); return
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

            // collect voting tokens when needed
            var vt = null
            switch (tx.type) {
            case TransactionType.COMMENT:
            case TransactionType.VOTE:
            case TransactionType.PROMOTED_COMMENT:
                vt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
                vt.v -= Math.abs(tx.data.vt)
                break
            case TransactionType.TRANSFER_VT:
                vt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
                vt.v -= tx.data.amount
                break
            default:
                break
            }

            // update both at the same time !
            var changes = {bw: bw}
            if (vt) changes.vt = vt
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
            switch (tx.type) {
            case TransactionType.NEW_ACCOUNT:
                db.collection('accounts').insertOne({
                    name: tx.data.name.toLowerCase(),
                    pub: tx.data.pub,
                    balance: 0,
                    bw: {v:0,t:0},
                    vt: {v:0,t:0},
                    pr: {v:0,t:0},
                    uv: 0,
                    follows: [],
                    followers: [],
                    keys: []
                }).then(function(){
                    if (tx.data.name !== tx.data.pub.toLowerCase()) 
                        if (tx.sender !== config.masterName || config.masterPaysForUsernames) {
                            cache.updateOne('accounts', 
                                {name: tx.sender},
                                {$inc: {balance: -eco.accountPrice(tx.data.name)}}, function() {
                                    cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                                        if (err) throw err
                                        // update his bandwidth
                                        acc.balance += eco.accountPrice(tx.data.name)
                                        transaction.updateGrowInts(acc, ts, function() {
                                            if (!acc.approves) acc.approves = []
                                            // and update his node_owners approvals values too
                                            var node_appr_before = Math.floor(acc.balance/acc.approves.length)
                                            acc.balance -= eco.accountPrice(tx.data.name)
                                            var node_appr = Math.floor(acc.balance/acc.approves.length)
                                            var node_owners = []
                                            for (let i = 0; i < acc.approves.length; i++)
                                                node_owners.push(acc.approves[i])
                                            cache.updateMany('accounts', 
                                                {name: {$in: node_owners}},
                                                {$inc: {node_appr: node_appr-node_appr_before}},
                                                function(err) {
                                                    if (err) throw err
                                                    cb(true, null, eco.accountPrice(tx.data.name))
                                                })
                                        })
                                    })
                                })
                        } else cb(true)
                    else cb(true)
                })
                break
    
            case TransactionType.APPROVE_NODE_OWNER:
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$push: {approves: tx.data.target}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err
                            if (!acc.approves) acc.approves = []
                            var node_appr = Math.floor(acc.balance/acc.approves.length)
                            var node_appr_before = (acc.approves.length === 1 ? 0 : Math.floor(acc.balance/(acc.approves.length-1)))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] !== tx.data.target)
                                    node_owners.push(acc.approves[i])
    
                            cache.updateMany('accounts', 
                                {name: {$in: node_owners}},
                                {$inc: {node_appr: node_appr-node_appr_before}}, function() {
                                    cache.updateOne('accounts', 
                                        {name: tx.data.target},
                                        {$inc: {node_appr: node_appr}}, function() {
                                            cb(true)
                                        }
                                    )
                                })
                        })
                    })
                break
    
            case TransactionType.DISAPROVE_NODE_OWNER:
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$pull: {approves: tx.data.target}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err
                            if (!acc.approves) acc.approves = []
                            var node_appr = (acc.approves.length === 0 ? 0 : Math.floor(acc.balance/acc.approves.length))
                            var node_appr_before = Math.floor(acc.balance/(acc.approves.length+1))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] !== tx.data.target)
                                    node_owners.push(acc.approves[i])
    
                            cache.updateMany('accounts', 
                                {name: {$in: node_owners}},
                                {$inc: {node_appr: node_appr-node_appr_before}}, function() {
                                    cache.updateOne('accounts', 
                                        {name: tx.data.target},
                                        {$inc: {node_appr: -node_appr_before}}, function() {
                                            cb(true)
                                        }
                                    )
                                })
                        })
                    })
                break
    
            case TransactionType.TRANSFER:
                // remove funds from sender
                tx.data.amount = Math.floor(tx.data.amount)
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$inc: {balance: -tx.data.amount}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err
                            // update his bandwidth
                            acc.balance += tx.data.amount
                            transaction.updateGrowInts(acc, ts, function() {
                                transaction.adjustNodeAppr(acc, -tx.data.amount, function() {
                                    // add funds to receiver
                                    cache.updateOne('accounts', 
                                        {name: tx.data.receiver},
                                        {$inc: {balance: tx.data.amount}},
                                        function() {
                                            cache.findOne('accounts', {name: tx.data.receiver}, function(err, acc) {
                                                if (err) throw err
                                                // update his bandwidth
                                                acc.balance -= tx.data.amount
                                                transaction.updateGrowInts(acc, ts, function() {
                                                    transaction.adjustNodeAppr(acc, tx.data.amount, function() {
                                                        cb(true)
                                                    })
                                                })
                                            })
                                        })
                                })
                            })
                        })
                    })
                break

            case TransactionType.COMMENT:
                cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                    if (err) throw err
                    if (content) 
                        // existing content being edited
                        cache.updateOne('contents', {_id: tx.sender+'/'+tx.data.link}, {
                            $set: {json: tx.data.json}
                        }, function(){
                            content.json = tx.data.json
                            if (!tx.data.pa && !tx.data.pp)
                                http.newRankingContent(content)
                            cb(true)
                        })
                    else {
                        // new content
                        var vote = {
                            u: tx.sender,
                            ts: ts,
                            vt: tx.data.vt
                        }
                        if (tx.data.tag) vote.tag = tx.data.tag
                        var newContent = {
                            _id: tx.sender+'/'+tx.data.link,
                            author: tx.sender,
                            link: tx.data.link,
                            pa: tx.data.pa,
                            pp: tx.data.pp,
                            json: tx.data.json,
                            child: [],
                            votes: [vote],
                            ts: ts
                        }
                        db.collection('contents').insertOne(newContent).then(function(){
                            if (tx.data.pa && tx.data.pp) 
                                cache.updateOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, { $push: {
                                    child: [tx.sender, tx.data.link]
                                }}, function() {})
                            else 
                                http.newRankingContent(newContent)
                            
                            cb(true)
                        })
                    }
                })
                break

            case TransactionType.VOTE:
                var vote = {
                    u: tx.sender,
                    ts: ts,
                    vt: tx.data.vt
                }
                if (tx.data.tag) vote.tag = tx.data.tag
                cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link},{$push: {
                    votes: vote
                }}, function(){
                    eco.curation(tx.data.author, tx.data.link, function(distributed) {
                        if (!tx.data.pa && !tx.data.pp)
                            http.updateRankings(tx.data.author, tx.data.link, vote, distributed)
                        cb(true, distributed)
                    })
                })
                break
    
            case TransactionType.USER_JSON:
                cache.updateOne('accounts', {
                    name: tx.sender
                },{ $set: {
                    json: tx.data.json
                }}, function(){
                    cb(true)
                })
                break

            case TransactionType.FOLLOW:
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$push: {follows: tx.data.target}},
                    function() {
                        cache.updateOne('accounts', 
                            {name: tx.data.target},
                            {$push: {followers: tx.sender}},
                            function() {
                                cb(true)
                            })
                    })
                break

            case TransactionType.UNFOLLOW:
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$pull: {follows: tx.data.target}},
                    function() {
                        cache.updateOne('accounts', 
                            {name: tx.data.target},
                            {$pull: {followers: tx.sender}},
                            function() {
                                cb(true)
                            })
                    })
                break

            case TransactionType.NEW_KEY:
                cache.updateOne('accounts', {
                    name: tx.sender
                },{ $push: {
                    keys: tx.data
                }},function(){
                    cb(true)
                })
                break

            case TransactionType.REMOVE_KEY:
                cache.updateOne('accounts', {
                    name: tx.sender
                },{ $pull: {
                    keys: tx.data
                }},function(){
                    cb(true)
                })
                break

            case TransactionType.CHANGE_PASSWORD:
                cache.updateOne('accounts', {name: tx.sender}, {$set: {pub: tx.data.pub}}, function() {
                    cb(true)
                })
                break
            
            case TransactionType.PROMOTED_COMMENT:
                // almost same logic as comment
                // except we are sure its a new content
                var superVote = {
                    u: tx.sender,
                    ts: ts,
                    vt: tx.data.vt+(tx.data.burn * config.vtPerBurn) // we just add some extra VTs
                }
                if (tx.data.tag) superVote.tag = tx.data.tag
                var newContent = {
                    _id: tx.sender+'/'+tx.data.link,
                    author: tx.sender,
                    link: tx.data.link,
                    pa: tx.data.pa,
                    pp: tx.data.pp,
                    json: tx.data.json,
                    child: [],
                    votes: [superVote],
                    ts: ts
                }
                // and burn some coins, update bw/vt and leader vote scores as usual
                cache.updateOne('accounts', {name: tx.sender}, {$inc: {balance: -tx.data.burn}}, function() {
                    cache.findOne('accounts', {name: tx.sender}, function(err, sender) {
                        transaction.updateGrowInts(sender, ts, function() {
                            transaction.adjustNodeAppr(sender, -tx.data.burn, function() {
                                // insert content+vote into db
                                db.collection('contents').insertOne(newContent).then(function(){
                                    if (tx.data.pa && tx.data.pp) 
                                        cache.updateOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, { $push: {
                                            child: [tx.sender, tx.data.link]
                                        }}, function() {})
                                    else 
                                        http.newRankingContent(newContent)
                                    
                                    // and report how much was burnt
                                    cb(true, null, tx.data.burn)
                                })
                            })
                        })
                    })
                    
                })
                break

            case TransactionType.TRANSFER_VT:
                cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                    if (err) throw err
                    account.vt.v += tx.data.amount
                    cache.updateOne('accounts', {name: tx.data.receiver}, {$set: {vt: account.vt}}, function() {
                        cb(true)
                    })
                })
                break

            case TransactionType.TRANSFER_BW:
                cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                    if (err) throw err
                    account.bw.v += tx.data.amount
                    cache.updateOne('accounts', {name: tx.data.receiver}, {$set: {vt: account.vt}}, function() {
                        cb(true)
                    })
                })
                break
            
            default:
                cb(false)
                break
            }
        })

    },
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the balance changes (transfer, monetary distribution)
        if (!account.bw || !account.vt) 
            logr.debug('error loading grow int', account)
        
        var bw = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth), max:config.bwMax}).grow(ts)
        var vt = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
        if (!bw || !vt) {
            logr.fatal('error growing grow int', account, ts)
            return
        }
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
        // updates the node_appr values for the node owners the account approves
        if (!acc.approves) acc.approves = []
        var node_appr_before = Math.floor(acc.balance/acc.approves.length)
        acc.balance += newCoins
        var node_appr = Math.floor(acc.balance/acc.approves.length)
        
        var node_owners = []
        for (let i = 0; i < acc.approves.length; i++)
            node_owners.push(acc.approves[i])
        
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