var GrowInt = require('./growInt.js')
var TransactionType = {
    NEW_ACCOUNT: 0,
    APPROVE_NODE_OWNER: 1,
    DISAPROVE_NODE_OWNER: 2,
    TRANSFER: 3,
    COMMENT: 4,
    VOTE: 5,
    EDIT_USER_JSON: 6,
    RESHARE: 7, // not sure
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
            console.log('no transaction')
            cb(false); return
        }
        // checking required variables one by one
        if (typeof tx.type !== "number") {
            console.log('invalid tx type')
            cb(false); return
        }
        if (!tx.data || typeof tx.data !== "object") {
            console.log('invalid tx data')
            cb(false); return
        }
        if (!tx.sender || typeof tx.sender !== "string") {
            console.log('invalid tx sender')
            cb(false); return
        }
        if (!tx.ts || typeof tx.ts !== "number") {
            console.log('invalid tx ts')
            cb(false); return
        }
        if (!tx.hash || typeof tx.hash !== "string") {
            console.log('invalid tx hash')
            cb(false); return
        }
        if (!tx.signature || typeof tx.signature !== "string") {
            console.log('invalid tx signature')
            cb(false); return
        }

        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > 60000) {
            console.log('invalid timestamp')
            cb(false); return
        }
        // check if this tx hash was already added to chain recently
        if (transaction.isPublished(tx)) {
            console.log('transaction already in chain')
            cb(false); return
        }

        // checking transaction signature
        chain.isValidSignature(tx.sender, tx.hash, tx.signature, function(legitUser) {
            if (!legitUser) {
                console.log('invalid signature')
                cb(false); return
            }

            // checking if the user has enough bandwidth
            if (JSON.stringify(tx).length > new GrowInt(legitUser.bw, {growth:legitUser.balance/(60000), max:1048576}).grow(ts).v) {
                console.log('not enough bandwidth')
                cb(false); return
            }

            // check transaction specifics
            switch (tx.type) {
                case TransactionType.NEW_ACCOUNT:
                    if (!tx.data.name || typeof tx.data.name !== "string" || tx.data.name.length > 25) {
                        console.log('invalid tx data.name')
                        cb(false); return
                    }
                    if (!tx.data.pub || typeof tx.data.pub !== "string" || tx.data.pub.length > 50) {
                        console.log('invalid tx data.pub')
                        cb(false); return
                    }

                    for (let i = 0; i < tx.data.name.length; i++) {
                        const c = tx.data.name[i];
                        // allowed username chars
                        if ('abcdefghijklmnopqrstuvwxyz0123456789'.indexOf(c) == -1) {
                            console.log('invalid tx data.name char')
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
                        console.log('invalid tx data.target')
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
                        console.log('invalid tx data.target')
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
                        console.log('invalid tx data.receiver')
                        cb(false); return
                    }
                    if (!tx.data.amount || typeof tx.data.amount !== "number") {
                        console.log('invalid tx data.amount')
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
                        console.log('invalid tx data.link')
                        cb(false); return
                    }
                    // parent author
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pa !== "string" || tx.data.pa.length > 25)) {
                        console.log('invalid tx data.pa')
                        cb(false); return
                    }
                    // parent permlink
                    if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pp !== "string" || tx.data.pp.length > 25)) {
                        console.log('invalid tx data.pp')
                        cb(false); return
                    }
                    // handle arbitrary json input
                    console.log(typeof tx.data.json)
                    if (!tx.data.json || typeof tx.data.json !== "string" || tx.data.json.length > 250000) {
                        console.log('invalid tx data.json')
                        cb(false); return
                    }
                    try {
                        var parsedJson = JSON.parse(tx.data.json);
                    } catch(e) {
                        console.log('unparsable tx data.json')
                        cb(false); return
                    }
                    if (!parsedJson || typeof parsedJson !== "object") {
                        console.log('invalid tx data.json parsed')
                        cb(false); return
                    }

                    // commenting costs 1 vote token as a forced self-upvote
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < 1) {
                        console.log('not enough vt for comment')
                        cb(false); return
                    }

                    cb(true)
                    break;

                case TransactionType.VOTE:
                    if (!tx.data.author || typeof tx.data.author !== "string" || tx.data.author.length > 25) {
                        console.log('invalid tx data.author')
                        cb(false); return
                    }
                    if (!tx.data.link || typeof tx.data.link !== "string" || tx.data.link.length > 25) {
                        console.log('invalid tx data.link')
                        cb(false); return
                    }
                    if (!tx.data.vt || typeof tx.data.vt !== "number") {
                        console.log('invalid tx data.vt')
                        cb(false); return
                    }
                    var vt = new GrowInt(legitUser.vt, {growth:legitUser.balance/(3600000)}).grow(ts)
                    if (vt.v < tx.data.vt) {
                        console.log('invalid tx not enough vt')
                        cb(false); return
                    }
                    cb(true)
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
                        json: JSON.parse(tx.data.json),
                    }, {
                        upsert: true
                    }).then(function(){
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