var GrowInt = require('./growInt.js')
var TransactionType = {
    NEW_ACCOUNT: 0,
    APPROVE_NODE_OWNER: 1,
    DISAPROVE_NODE_OWNER: 2,
    TRANSFER: 3,
    COMMENT: 4,
    VOTE: 5,
    USER_JSON: 6,
    FOLLOW: 7,
    UNFOLLOW: 8,
    RESHARE: 9, // not sure
};

transaction = {
    pool: [], // the pool holds temporary txs that havent been published on chain yet
    addToPool: (txs) => {
        for (let y = 0; y < txs.length; y++) {
            var exists = false;
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash == txs[y].hash)
                    exists = true
            
            if (!exists)
                transaction.pool.push(txs[y])
        }
        
    },
    removeFromPool: (txs) => {
        for (let y = 0; y < txs.length; y++)
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash == txs[y].hash) {
                    transaction.pool.splice(i, 1)
                    break
                }
                    
    },
    isInPool: (tx) => {
        var isInPool = false
        for (let i = 0; i < transaction.pool.length; i++)
            if (transaction.pool[i].hash == tx.hash) {
                isInPool = true
                break
            }
        return isInPool
    },
    isPublished: (tx) => {
        if (!tx.hash) return
        for (let i = 0; i < chain.recentBlocks.length; i++) {
            const txs = chain.recentBlocks[i].txs
            for (let y = 0; y < txs.length; y++) {
                if (txs[y].hash == tx.hash)
                    return true
            }
        }
        return false
    },
    isValid: (tx, ts, cb) => {
        if (!tx) {
            logr.debug('no transaction')
            cb(false); return
        }
        // checking required variables one by one
        if (typeof tx.type !== "number" || tx.type < 0 || tx.type > Number.MAX_SAFE_INTEGER) {
            logr.debug('invalid tx type')
            cb(false); return
        }
        if (!tx.data || typeof tx.data !== "object") {
            logr.debug('invalid tx data')
            cb(false); return
        }
        if (!tx.sender || typeof tx.sender !== "string") {
            logr.debug('invalid tx sender')
            cb(false); return
        }
        if (!tx.ts || typeof tx.ts !== "number" || tx.ts < 0 || tx.ts > Number.MAX_SAFE_INTEGER) {
            logr.debug('invalid tx ts')
            cb(false); return
        }
        if (!tx.hash || typeof tx.hash !== "string") {
            logr.debug('invalid tx hash')
            cb(false); return
        }
        if (!tx.signature || typeof tx.signature !== "string") {
            logr.debug('invalid tx signature')
            cb(false); return
        }

        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > 60000) {
            logr.debug('invalid timestamp')
            cb(false); return
        }
        // check if this tx hash was already added to chain recently
        if (transaction.isPublished(tx)) {
            logr.debug('transaction already in chain')
            cb(false); return
        }

        // checking transaction signature
        chain.isValidSignature(tx.sender, tx.hash, tx.signature, function(legitUser) {
            if (!legitUser) {
                logr.debug('invalid signature')
                cb(false); return
            }

            // checking if the user has enough bandwidth
            if (JSON.stringify(tx).length > new GrowInt(legitUser.bw, {growth:legitUser.balance/(60000), max:1048576}).grow(ts).v) {
                logr.debug('not enough bandwidth')
                cb(false); return
            }

            // check transaction specifics
            switch (tx.type) {
                case TransactionType.NEW_ACCOUNT:
                    if (!tx.data.name || typeof tx.data.name !== "string" || tx.data.name.length > 25) {
                        logr.debug('invalid tx data.name')
                        cb(false); return
                    }
                    if (!tx.data.pub || typeof tx.data.pub !== "string" || tx.data.pub.length > 50) {
                        logr.debug('invalid tx data.pub')
                        cb(false); return
                    }

                    for (let i = 0; i < tx.data.name.length; i++) {
                        const c = tx.data.name[i];
                        // allowed username chars
                        if ('abcdefghijklmnopqrstuvwxyz0123456789'.indexOf(c) == -1) {
                            logr.debug('invalid tx data.name char')
                            cb(false); return
                        }
                    }

                    // only master is allowed to create accounts !!
                    if (tx.sender !== "master") {
                        cb(false); return
                    }

                    db.collection('accounts').findOne({name: tx.data.name}, function(err, account) {
                        if (err) throw err;
                        if (account)
                            cb(false)
                        else
                            cb(true)
                    })
                    break;
                

                case TransactionType.APPROVE_NODE_OWNER:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 25) {
                        logr.debug('invalid tx data.target')
                        cb(false); return
                    }

                    db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.approves) acc.approves = []
                        if (acc.approves.indexOf(tx.data.target) > -1) {
                            cb(false); return
                        }
                        if (acc.approves.length >= 5)
                            cb(false)
                        else {
                            db.collection('accounts').findOne({name: tx.data.target}, function(err, account) {
                                if (!account) {
                                    cb(false)
                                } else {
                                    cb(true)
                                }
                            })
                        }
                    })
                    break;

                case TransactionType.DISAPROVE_NODE_OWNER:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 25) {
                        logr.debug('invalid tx data.target')
                        cb(false); return
                    }

                    db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.approves) acc.approves = []
                        if (acc.approves.indexOf(tx.data.target) == -1) {
                            cb(false); return
                        }
                        db.collection('accounts').findOne({name: tx.data.target}, function(err, account) {
                            if (!account) {
                                cb(false)
                            } else {
                                cb(true)
                            }
                        })
                    })
                    break;

                case TransactionType.TRANSFER:
                    if (!tx.data.receiver || typeof tx.data.receiver !== "string" || tx.data.receiver.length > 25) {
                        logr.debug('invalid tx data.receiver')
                        cb(false); return
                    }
                    if (!tx.data.amount || typeof tx.data.amount !== "number" || tx.data.amount < 1 || tx.data.amount > Number.MAX_SAFE_INTEGER) {
                        logr.debug('invalid tx data.amount')
                        cb(false); return
                    }
                    if (tx.data.amount != Math.floor(tx.data.amount)) {
                        logr.debug('invalid tx data.amount not an integer')
                        cb(false); return
                    }
                    
                    db.collection('accounts').findOne({name: tx.sender}, function(err, account) {
                        if (err) throw err;
                        if (account.balance < tx.data.amount)
                            cb(false)
                        else {
                            db.collection('accounts').findOne({name: tx.data.receiver}, function(err, account) {
                                if (err) throw err;
                                if (!account) cb(false)
                                else cb(true)
                            })
                        }
                    })
                    break;

                case TransactionType.COMMENT:
                    // permlink
                    if (!tx.data.link || typeof tx.data.link !== "string" || tx.data.link.length > 25) {
                        logr.debug('invalid tx data.link')
                        cb(false); return
                    }
                    // parent author
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pa !== "string" || tx.data.pa.length > 25)) {
                        logr.debug('invalid tx data.pa')
                        cb(false); return
                    }
                    // parent permlink
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pp !== "string" || tx.data.pp.length > 25)) {
                        logr.debug('invalid tx data.pp')
                        cb(false); return
                    }
                    // handle arbitrary json input
                    if (!tx.data.json || typeof tx.data.json !== "object" || JSON.stringify(tx.data.json).length > 250000) {
                        logr.debug('invalid tx data.json')
                        cb(false); return
                    }
                    // commenting costs 1 vote token as a forced self-upvote
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < 1) {
                        logr.debug('not enough vt for comment')
                        cb(false); return
                    }

                    if (tx.data.pa && tx.data.pp) {
                        // its a comment of another comment
                        db.collection('contents').findOne({author: tx.data.pa, link: tx.data.pp}, function(err, content) {
                            if (!content) {
                                logr.debug('new comment tried to reference a non existing comment')
                                cb(false); return
                            }
                            db.collection('contents').findOne({author: tx.sender, link: tx.data.link}, function(err, content) {
                                if (content) {
                                    // user is editing an existing comment
                                    if (content.pa != tx.data.pa || content.pp != tx.data.pp) {
                                        logr.debug('users tried to change the pa and/or pp of a comment')
                                        cb(false); return
                                    }
                                } else {
                                    // it is a new comment
                                    cb(true)
                                }
                            })
                        })
                    } else {
                        cb(true)
                    }

                    break;

                case TransactionType.VOTE:
                    if (!tx.data.author || typeof tx.data.author !== "string" || tx.data.author.length > 25) {
                        logr.debug('invalid tx data.author')
                        cb(false); return
                    }
                    if (!tx.data.link || typeof tx.data.link !== "string" || tx.data.link.length > 25) {
                        logr.debug('invalid tx data.link')
                        cb(false); return
                    }
                    if (!tx.data.vt || typeof tx.data.vt !== "number" || tx.data.vt < Number.MIN_SAFE_INTEGER || tx.data.vt > Number.MAX_SAFE_INTEGER) {
                        logr.debug('invalid tx data.vt')
                        cb(false); return
                    }
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < tx.data.vt) {
                        logr.debug('invalid tx not enough vt')
                        cb(false); return
                    }
                    cb(true)
                    break;

                case TransactionType.USER_JSON:
                    // handle arbitrary json input
                    if (!tx.data.json || typeof tx.data.json !== "object" || JSON.stringify(tx.data.json).length > 250000) {
                        logr.debug('invalid tx data.json')
                        cb(false); return
                    }
                    cb(true)
                    break;

                case TransactionType.FOLLOW:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 25) {
                        logr.debug('invalid tx data.target')
                        cb(false); return
                    }

                    db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.follows) acc.follows = []
                        if (acc.follows.indexOf(tx.data.target) > -1) {
                            cb(false); return
                        }
                        if (acc.follows.length >= 2000)
                            cb(false)
                        else {
                            db.collection('accounts').findOne({name: tx.data.target}, function(err, account) {
                                if (!account) {
                                    cb(false)
                                } else {
                                    cb(true)
                                }
                            })
                        }
                    })
                    break;

                case TransactionType.UNFOLLOW:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 25) {
                        logr.debug('invalid tx data.target')
                        cb(false); return
                    }

                    db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.follows) acc.follows = []
                        if (acc.follows.indexOf(tx.data.target) == -1) {
                            cb(false); return
                        }
                        db.collection('accounts').findOne({name: tx.data.target}, function(err, account) {
                            if (!account) {
                                cb(false)
                            } else {
                                cb(true)
                            }
                        })
                    })
                    break;

                default:
                    cb(false)
                    break;
            }
        })
    },
    execute: (tx, ts, cb) => {
        transaction.collectGrowInts(tx, ts, function(success) {
            if (!success) throw 'Error collecting bandwidth'
            switch (tx.type) {
                case TransactionType.NEW_ACCOUNT:
                    db.collection('accounts').insertOne({
                        name: tx.data.name,
                        pub: tx.data.pub,
                        balance: 0,
                        bw: {v:0,t:0},
                        vt: {v:0,t:0}
                    }).then(function(){
                        cb(true)
                    })
                    break;
    
                case TransactionType.APPROVE_NODE_OWNER:
                    db.collection('accounts').updateOne(
                        {name: tx.sender},
                        {$push: {approves: tx.data.target}},
                    function() {
                        db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            if (!acc.approves) acc.approves = []
                            var node_appr = Math.floor(acc.balance/acc.approves.length)
                            var node_appr_before = Math.floor(acc.balance/(acc.approves.length-1))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] != tx.data.target)
                                    node_owners.push(acc.approves[i])
    
                            db.collection('accounts').updateMany(
                                {name: {$in: node_owners}},
                                {$inc: {node_appr: node_appr-node_appr_before}}, function() {
                                db.collection('accounts').updateOne(
                                    {name: tx.data.target},
                                    {$inc: {node_appr: node_appr}}, function() {
                                        cb(true)
                                    }
                                )
                            })
                        })
                    })
                    break;
    
                case TransactionType.DISAPROVE_NODE_OWNER:
                    db.collection('accounts').updateOne(
                        {name: tx.sender},
                        {$pull: {approves: tx.data.target}},
                    function() {
                        db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            if (!acc.approves) acc.approves = []
                            var node_appr = Math.floor(acc.balance/acc.approves.length)
                            var node_appr_before = Math.floor(acc.balance/(acc.approves.length+1))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] != tx.data.target)
                                    node_owners.push(acc.approves[i])
    
                            db.collection('accounts').updateMany(
                                {name: {$in: node_owners}},
                                {$inc: {node_appr: node_appr-node_appr_before}}, function() {
                                db.collection('accounts').updateOne(
                                    {name: tx.data.target},
                                    {$inc: {node_appr: -node_appr}}, function() {
                                        cb(true)
                                    }
                                )
                            })
                        })
                    })
                    break;
    
                case TransactionType.TRANSFER:
                    // remove funds from sender
                    tx.data.amount = Math.floor(tx.data.amount)
                    db.collection('accounts').updateOne(
                        {name: tx.sender},
                        {$inc: {balance: -tx.data.amount}},
                    function() {
                        db.collection('accounts').findOne({name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            // update his bandwidth
                            acc.balance += tx.data.amount
                            transaction.updateGrowInts(acc, ts, function(success) {
                                if (!acc.approves) acc.approves = []
                                // and update node_appr for miners he votes for
                                var node_appr_before = Math.floor(acc.balance/acc.approves.length)
                                acc.balance -= tx.data.amount
                                var node_appr = Math.floor(acc.balance/acc.approves.length)
                                
                                var node_owners = []
                                for (let i = 0; i < acc.approves.length; i++)
                                    node_owners.push(acc.approves[i])
                                
                                db.collection('accounts').updateMany(
                                    {name: {$in: node_owners}},
                                    {$inc: {node_appr: node_appr-node_appr_before}}
                                , function(err) {
                                    if (err) throw err;
                                    // add funds to receiver
                                    db.collection('accounts').updateOne(
                                        {name: tx.data.receiver},
                                        {$inc: {balance: tx.data.amount}},
                                    function() {
                                        db.collection('accounts').findOne({name: tx.data.receiver}, function(err, acc) {
                                            if (err) throw err;
                                            // update his bandwidth
                                            acc.balance -= tx.data.amount
                                            transaction.updateGrowInts(acc, ts, function(success) {
                                                if (!acc.approves) acc.approves = []
                                                // and update his node_owners approvals values too
                                                var node_appr_before = Math.floor(acc.balance/acc.approves.length)
                                                acc.balance += tx.data.amount
                                                var node_appr = Math.floor(acc.balance/acc.approves.length)
                                                var node_owners = []
                                                for (let i = 0; i < acc.approves.length; i++)
                                                    node_owners.push(acc.approves[i])
                                                db.collection('accounts').updateMany(
                                                    {name: {$in: node_owners}},
                                                    {$inc: {node_appr: node_appr-node_appr_before}},
                                                function(err) {
                                                    if (err) throw err;
                                                    // and update his tokens variable on balance
        
                                                    cb(true)
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                    break;

                case TransactionType.COMMENT:
                    db.collection('contents').replaceOne({
                        author: tx.sender,
                        link: tx.data.link
                    },{
                        author: tx.sender,
                        link: tx.data.link,
                        pa: tx.data.pa,
                        pp: tx.data.pp,
                        json: tx.data.json,
                    }, {
                        upsert: true
                    }).then(function(){
                        db.collection('contents').updateOne({
                            author: tx.data.pa,
                            link: tx.data.pp
                        }, { $addToSet: {
                            child: [tx.sender, tx.data.link]
                        }})
                        cb(true)
                    })
                    break;

                case TransactionType.VOTE:
                    var vote = {
                        u: tx.sender,
                        ts: ts,
                        vt: tx.data.vt
                    }
                    db.collection('contents').updateOne({
                        author: tx.data.author,
                        link: tx.data.link
                    },{$push: {
                        votes: vote
                    }}, {
                        upsert: true
                    }).then(function(){
                        cb(true)
                    })
                    break;
    
                case TransactionType.USER_JSON:
                    db.collection('accounts').updateOne({
                        name: tx.sender
                    },{ $set: {
                        json: tx.data.json
                    }}).then(function(){
                        cb(true)
                    })
                    break;

                case TransactionType.FOLLOW:
                    db.collection('accounts').updateOne(
                        {name: tx.sender},
                        {$push: {follows: tx.data.target}},
                    function() {
                        db.collection('accounts').updateOne(
                            {name: tx.data.target},
                            {$push: {followers: tx.sender}},
                        function() {
                            cb(true)
                        })
                    })
                    break;

                case TransactionType.UNFOLLOW:
                    db.collection('accounts').updateOne(
                        {name: tx.sender},
                        {$pull: {follows: tx.data.target}},
                    function() {
                        db.collection('accounts').updateOne(
                            {name: tx.data.target},
                            {$pull: {followers: tx.sender}},
                        function() {
                            cb(true)
                        })
                    })
                    break;

                default:
                    cb(false)
                    break;
            }
        })

    },
    collectGrowInts: (tx, ts, cb) => {
        db.collection('accounts').findOne({name: tx.sender}, function(err, account) {
            // collect bandwidth
            var bandwidth = new GrowInt(account.bw, {growth:account.balance/(60000), max:1048576})
            var needed_bytes = JSON.stringify(tx).length;
            var bw = bandwidth.grow(ts)
            bw.v -= needed_bytes

            // collect voting tokens when needed
            switch (tx.type) {
                case TransactionType.COMMENT:
                    var vt = new GrowInt(account.vt, {growth:account.balance/(3600000)}).grow(ts)
                    vt.v -= 1
                    break;

                case TransactionType.VOTE:
                    var vt = new GrowInt(account.vt, {growth:account.balance/(3600000)}).grow(ts)
                    vt.v -= Math.abs(tx.data.vt)
                    break;
            
                default:
                    break;
            }

            // update both at the same time !
            var changes = {bw: bw}
            if (vt) changes.vt = vt
            db.collection('accounts').updateOne(
                {name: account.name},
                {$set: changes},
            function(err) {
                if (err) throw err;
                cb(true)
            })
        })
    },
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the growth changes (transfer)
        var bw = new GrowInt(account.bw, {growth:account.balance/(60000), max:1048576}).grow(ts)
        var vt = new GrowInt(account.vt, {growth:account.balance/(3600000)}).grow(ts)
        db.collection('accounts').updateOne(
            {name: account.name},
            {$set: {
                bw: bw,
                vt: vt
            }},
        function(err) {
            if (err) throw err;
            cb(true)
        })
    }
}

module.exports = transaction