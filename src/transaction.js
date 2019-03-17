var GrowInt = require('./growInt.js')
var eco = require('./economics.js')

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
    NEW_KEY: 10,
    REMOVE_KEY: 11
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
            cb(false, 'no transaction'); return
        }
        // checking required variables one by one
        if (typeof tx.type !== "number" || tx.type < 0 || tx.type > Number.MAX_SAFE_INTEGER) {
            cb(false, 'invalid tx type'); return
        }
        if (!tx.data || typeof tx.data !== "object") {
            cb(false, 'invalid tx data'); return
        }
        if (!tx.sender || typeof tx.sender !== "string") {
            cb(false, 'invalid tx sender'); return
        }
        if (!tx.ts || typeof tx.ts !== "number" || tx.ts < 0 || tx.ts > Number.MAX_SAFE_INTEGER) {
            cb(false, 'invalid tx ts'); return
        }
        if (!tx.hash || typeof tx.hash !== "string") {
            cb(false, 'invalid tx hash'); return
        }
        if (!tx.signature || typeof tx.signature !== "string") {
            cb(false, 'invalid tx signature'); return
        }

        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > 60000) {
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

            var newBw = new GrowInt(legitUser.bw, {growth:legitUser.balance/(60000), max:1048576}).grow(ts)

            if (!newBw) {
                logr.debug(legitUser)
                cb(false, 'error debug'); return
            }

            // checking if the user has enough bandwidth
            if (JSON.stringify(tx).length > newBw.v) {
                cb(false, 'not enough bandwidth'); return
            }

            // check transaction specifics
            switch (tx.type) {
                case TransactionType.NEW_ACCOUNT:
                    if (!tx.data.name || typeof tx.data.name !== "string" || tx.data.name.length > 50) {
                        cb(false, 'invalid tx data.name'); return
                    }
                    if (!tx.data.pub || typeof tx.data.pub !== "string" || tx.data.pub.length > 50 || !chain.isValidPubKey(tx.data.pub)) {
                        cb(false, 'invalid tx data.pub'); return
                    }

                    var lowerUser = tx.data.name.toLowerCase()

                    for (let i = 0; i < lowerUser.length; i++) {
                        const c = lowerUser[i];
                        // allowed username chars
                        if (chain.allowedUsernameChars.indexOf(c) == -1) {
                            cb(false, 'invalid tx data.name char'); return
                        }
                    }

                    cache.findOne('accounts', {name: lowerUser}, function(err, account) {
                        if (err) throw err;
                        if (account)
                            cb(false, 'invalid tx data.name already exists')
                        else if (tx.data.name !== tx.data.pub || tx.data.name.length < 25) {
                            // if it's not a free account, check tx sender balance
                            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                                if (err) throw err;
                                if (account.balance < 60)
                                    cb(false, 'invalid tx not enough balance')
                                else
                                    cb(true)
                            })
                        } else cb(true)
                    })
                    break;
                

                case TransactionType.APPROVE_NODE_OWNER:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 50) {
                        cb(false, 'invalid tx data.target'); return
                    }

                    cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.approves) acc.approves = []
                        if (acc.approves.indexOf(tx.data.target) > -1) {
                            cb(false, 'invalid tx already voting'); return
                        }
                        if (acc.approves.length >= 5)
                            cb(false, 'invalid tx max votes reached')
                        else {
                            cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                                if (!account) {
                                    cb(false, 'invalid tx target does not exist')
                                } else {
                                    cb(true)
                                }
                            })
                        }
                    })
                    break;

                case TransactionType.DISAPROVE_NODE_OWNER:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 50) {
                        cb(false, 'invalid tx data.target'); return
                    }

                    cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.approves) acc.approves = []
                        if (acc.approves.indexOf(tx.data.target) == -1) {
                            cb(false, 'invalid tx already unvoted'); return
                        }
                        cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                            if (!account) {
                                cb(false, 'invalid tx target does not exist')
                            } else {
                                cb(true)
                            }
                        })
                    })
                    break;

                case TransactionType.TRANSFER:
                    if (!tx.data.receiver || typeof tx.data.receiver !== "string" || tx.data.receiver.length > 25) {
                        cb(false, 'invalid tx data.receiver'); return
                    }
                    if (!tx.data.amount || typeof tx.data.amount !== "number" || tx.data.amount < 1 || tx.data.amount > Number.MAX_SAFE_INTEGER) {
                        cb(false, 'invalid tx data.amount'); return
                    }
                    if (typeof tx.data.memo !== "string" || tx.data.memo.length > 250) {
                        cb(false, 'invalid tx data.memo'); return
                    }
                    if (tx.data.amount != Math.floor(tx.data.amount)) {
                        cb(false, 'invalid tx data.amount not an integer'); return
                    }
                    if (tx.data.receiver === tx.sender) {
                        cb(false, 'invalid tx cannot send to self'); return
                    }
                    
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (err) throw err;
                        if (account.balance < tx.data.amount)
                            cb(false, 'invalid tx not enough balance')
                        else {
                            cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                                if (err) throw err;
                                if (!account) cb(false, 'invalid tx receiver does not exist')
                                else cb(true)
                            })
                        }
                    })
                    break;

                case TransactionType.COMMENT:
                    // permlink
                    if (!tx.data.link || typeof tx.data.link !== "string" || tx.data.link.length > 25) {
                        cb(false, 'invalid tx data.link'); return
                    }
                    // parent author
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pa !== "string" || tx.data.pa.length > 25)) {
                        cb(false, 'invalid tx data.pa'); return
                    }
                    // parent permlink
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pp !== "string" || tx.data.pp.length > 25)) {
                        cb(false, 'invalid tx data.pp'); return
                    }
                    // handle arbitrary json input
                    if (!tx.data.json || typeof tx.data.json !== "object" || JSON.stringify(tx.data.json).length > 250000) {
                        cb(false, 'invalid tx data.json'); return
                    }
                    // commenting costs 1 vote token as a forced self-upvote
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < 1) {
                        cb(false, 'invalid tx not enough vt'); return
                    }

                    if (tx.data.pa && tx.data.pp) {
                        // its a comment of another comment
                        db.collection('contents').findOne({author: tx.data.pa, link: tx.data.pp}, function(err, content) {
                            if (!content) {
                                cb(false, 'invalid tx parent comment does not exist'); return
                            }
                            db.collection('contents').findOne({author: tx.sender, link: tx.data.link}, function(err, content) {
                                if (content) {
                                    // user is editing an existing comment
                                    if (content.pa != tx.data.pa || content.pp != tx.data.pp) {
                                        cb(false, 'invalid tx parent comment cannot be edited'); return
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
                        cb(false, 'invalid tx data.link'); return
                    }
                    if (!tx.data.vt || typeof tx.data.vt !== "number" || tx.data.vt < Number.MIN_SAFE_INTEGER || tx.data.vt > Number.MAX_SAFE_INTEGER) {
                        cb(false, 'invalid tx data.vt'); return
                    }
                    if (typeof tx.data.tag !== "string" || tx.data.tag.length > 25) {
                        cb(false, 'invalid tx data.tag'); return
                    }
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < Math.abs(tx.data.vt)) {
                        cb(false, 'invalid tx not enough vt'); return
                    }
                    cb(true)
                    break;

                case TransactionType.USER_JSON:
                    // handle arbitrary json input
                    if (!tx.data.json || typeof tx.data.json !== "object" || JSON.stringify(tx.data.json).length > 250000) {
                        cb(false, 'invalid tx data.json'); return
                    }
                    cb(true)
                    break;

                case TransactionType.FOLLOW:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 50) {
                        cb(false, 'invalid tx data.target'); return
                    }

                    cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.follows) acc.follows = []
                        if (acc.follows.indexOf(tx.data.target) > -1) {
                            cb(false, 'invalid tx already following'); return
                        }
                        if (acc.follows.length >= 2000)
                            cb(false, 'invalid tx reached max follows')
                        else {
                            cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                                if (!account) {
                                    cb(false, 'invalid tx target does not exist')
                                } else {
                                    cb(true)
                                }
                            })
                        }
                    })
                    break;

                case TransactionType.UNFOLLOW:
                    if (!tx.data.target || typeof tx.data.target !== "string" || tx.data.target.length > 50) {
                        cb(false, 'invalid tx data.target'); return
                    }

                    cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                        if (err) throw err;
                        if (!acc.follows) acc.follows = []
                        if (acc.follows.indexOf(tx.data.target) == -1) {
                            cb(false, 'invalid tx not following target'); return
                        }
                        cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                            if (!account) {
                                cb(false, 'invalid tx target does not exist')
                            } else {
                                cb(true)
                            }
                        })
                    })
                    break;

                case TransactionType.NEW_KEY:
                    if (!tx.data.id || typeof tx.data.id !== "string" || tx.data.id.length > 25) {
                        cb(false, 'invalid tx data.id'); return
                    }
                    if (!tx.data.pub || typeof tx.data.pub !== "string" || tx.data.pub.length > 50 || !chain.isValidPubKey(tx.data.pub)) {
                        cb(false, 'invalid tx data.pub'); return
                    }
                    if (!tx.data.types || !Array.isArray(tx.data.types) || tx.data.types.length < 1) {
                        cb(false, 'invalid tx data.types'); return
                    }
                    for (let i = 0; i < tx.data.types.length; i++) {
                        if (!Number.isInteger(tx.data.types[i])) {
                            cb(false, 'invalid tx all types must be integers'); return
                        }
                    }
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (!account) {
                            cb(false, 'invalid tx sender does not exist'); return
                        }
                        if (!account.keys) {
                            cb(true); return
                        } else {
                            for (let i = 0; i < account.keys.length; i++) {
                                if (account.keys[i].id === tx.data.id) {
                                    cb(false, 'invalid tx data.id already exists'); return
                                }
                            }
                            cb(true);
                        }
                    })
                    break;

                case TransactionType.REMOVE_KEY:
                    if (!tx.data.id || typeof tx.data.id !== "string" || tx.data.id.length > 25) {
                        cb(false, 'invalid tx data.id'); return
                    }
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (!account) {
                            cb(false, 'invalid tx sender does not exist'); return
                        }
                        if (!account.keys) {
                            cb(false, 'invalid tx could not find key'); return
                        } else {
                            for (let i = 0; i < account.keys.length; i++) {
                                if (account.keys[i].id === tx.data.id) {
                                    cb(true); return
                                }
                            }
                            cb(false, 'invalid tx could not find key');
                        }
                    })
                    break;
                
                default:
                    cb(false, 'invalid tx unknown transaction type')
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
                        name: tx.data.name.toLowerCase(),
                        pub: tx.data.pub,
                        balance: 0,
                        bw: {v:0,t:0},
                        vt: {v:0,t:0},
                        pr: {v:0,t:0},
                        uv: 0
                    }).then(function(){
                        if (tx.data.name !== tx.data.pub.toLowerCase() || tx.data.name.length < 25) {
                            cache.updateOne('accounts', 
                            {name: tx.sender},
                            {$inc: {balance: -60}}, function() {
                                cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                                    if (err) throw err;
                                    // update his bandwidth
                                    acc.balance += 60
                                    transaction.updateGrowInts(acc, ts, function(success) {
                                        if (!acc.approves) acc.approves = []
                                        // and update his node_owners approvals values too
                                        var node_appr_before = Math.floor(acc.balance/acc.approves.length)
                                        acc.balance -= 60
                                        var node_appr = Math.floor(acc.balance/acc.approves.length)
                                        var node_owners = []
                                        for (let i = 0; i < acc.approves.length; i++)
                                            node_owners.push(acc.approves[i])
                                        cache.updateMany('accounts', 
                                            {name: {$in: node_owners}},
                                            {$inc: {node_appr: node_appr-node_appr_before}},
                                        function(err) {
                                            if (err) throw err;
                                            cb(true, null, 60)
                                        })
                                    })
                                })
                            })
                        } else cb(true)
                    })
                    break;
    
                case TransactionType.APPROVE_NODE_OWNER:
                    cache.updateOne('accounts', 
                        {name: tx.sender},
                        {$push: {approves: tx.data.target}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            if (!acc.approves) acc.approves = []
                            var node_appr = Math.floor(acc.balance/acc.approves.length)
                            var node_appr_before = (acc.approves.length == 1 ? 0 : Math.floor(acc.balance/(acc.approves.length-1)))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] != tx.data.target)
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
                    break;
    
                case TransactionType.DISAPROVE_NODE_OWNER:
                    cache.updateOne('accounts', 
                        {name: tx.sender},
                        {$pull: {approves: tx.data.target}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            if (!acc.approves) acc.approves = []
                            var node_appr = (acc.approves.length == 0 ? 0 : Math.floor(acc.balance/acc.approves.length))
                            var node_appr_before = Math.floor(acc.balance/(acc.approves.length+1))
                            var node_owners = []
                            for (let i = 0; i < acc.approves.length; i++)
                                if (acc.approves[i] != tx.data.target)
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
                    break;
    
                case TransactionType.TRANSFER:
                    // remove funds from sender
                    tx.data.amount = Math.floor(tx.data.amount)
                    cache.updateOne('accounts', 
                        {name: tx.sender},
                        {$inc: {balance: -tx.data.amount}},
                    function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err;
                            // update his bandwidth
                            acc.balance += tx.data.amount
                            transaction.updateGrowInts(acc, ts, function(success) {
                                transaction.adjustNodeAppr(acc, -tx.data.amount, function(success) {
                                    // add funds to receiver
                                    cache.updateOne('accounts', 
                                        {name: tx.data.receiver},
                                        {$inc: {balance: tx.data.amount}},
                                    function() {
                                        cache.findOne('accounts', {name: tx.data.receiver}, function(err, acc) {
                                            if (err) throw err;
                                            // update his bandwidth
                                            acc.balance -= tx.data.amount
                                            transaction.updateGrowInts(acc, ts, function(success) {
                                                transaction.adjustNodeAppr(acc, tx.data.amount, function(success) {
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
                    db.collection('contents').findOne({author: tx.sender, link: tx.data.link}, function(err, content) {
                        if (err) throw err;
                        if (content) {
                            // existing content being edited
                            db.collection('contents').updateOne({
                                author: tx.sender,
                                link: tx.data.link
                            }, {
                                $set: {json: tx.data.json}
                            }).then(function(){
                                content.json = tx.data.json
                                if (!tx.data.pa && !tx.data.pp)
                                    http.newRankingContent(content)
                                cb(true)
                            })
                        } else {
                            // new content
                            var content = {
                                author: tx.sender,
                                link: tx.data.link,
                                pa: tx.data.pa,
                                pp: tx.data.pp,
                                json: tx.data.json,
                                ts: ts
                            }
                            db.collection('contents').replaceOne({
                                author: tx.sender,
                                link: tx.data.link
                            }, content, {
                                upsert: true
                            }).then(function(){
                                if (tx.data.pa && tx.data.pp) {
                                    db.collection('contents').updateOne({
                                        author: tx.data.pa,
                                        link: tx.data.pp
                                    }, { $addToSet: {
                                        child: [tx.sender, tx.data.link]
                                    }})
                                } else {
                                    http.newRankingContent(content)
                                }
                                cb(true)
                            })
                        }
                    })
                    break;

                case TransactionType.VOTE:
                    var vote = {
                        u: tx.sender,
                        ts: ts,
                        vt: tx.data.vt,
                        tag: tx.data.tag
                    }
                    db.collection('contents').updateOne({
                        author: tx.data.author,
                        link: tx.data.link
                    },{$push: {
                        votes: vote
                    }}, {
                        upsert: true
                    }).then(function(){
                        eco.curation(tx.data.author, tx.data.link, function(distributed) {
                            if (!tx.data.pa && !tx.data.pp)
                                http.updateRankings(tx.data.author, tx.data.link, vote, distributed)
                            cb(true, distributed)
                        })
                    })
                    break;
    
                case TransactionType.USER_JSON:
                    cache.updateOne('accounts', {
                        name: tx.sender
                    },{ $set: {
                        json: tx.data.json
                    }}, function(){
                        cb(true)
                    })
                    break;

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
                    break;

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
                    break;

                case TransactionType.NEW_KEY:
                    cache.updateOne('accounts', {
                        name: tx.sender
                    },{ $push: {
                        keys: tx.data
                    }},function(){
                        cb(true)
                    })
                    break;

                case TransactionType.REMOVE_KEY:
                    cache.updateOne('accounts', {
                        name: tx.sender
                    },{ $pull: {
                        keys: tx.data
                    }},function(){
                        cb(true)
                    })
                    break;

                default:
                    cb(false)
                    break;
            }
        })

    },
    collectGrowInts: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            // collect bandwidth
            var bandwidth = new GrowInt(account.bw, {growth:account.balance/(60000), max:1048576})
            var needed_bytes = JSON.stringify(tx).length;
            var bw = bandwidth.grow(ts)
            if (!bw) {
                throw 'No bandwidth error'
            }
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
            cache.updateOne('accounts', 
                {name: account.name},
                {$set: changes},
            function(err) {
                if (err) throw err;
                cb(true)
            })
        })
    },
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the balance changes (transfer, monetary distribution)
        if (!account.bw || !account.vt) {
            logr.debug('error loading grow int', account)
        }
        var bw = new GrowInt(account.bw, {growth:account.balance/(60000), max:1048576}).grow(ts)
        var vt = new GrowInt(account.vt, {growth:account.balance/(3600000)}).grow(ts)
        if (!bw || !vt) {
            logr.debug('error growing grow int', account, ts)
        }
        cache.updateOne('accounts', 
            {name: account.name},
            {$set: {
                bw: bw,
                vt: vt
            }},
        function(err) {
            if (err) throw err;
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
            if (err) throw err;
            cb(true)
        })
    }
}

module.exports = transaction