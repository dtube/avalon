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
    isPublished: (tx) => {
        if (!tx.hash) return
        for (let i = 0; i < tempBlocks.length; i++) {
            const txs = tempBlocks[i].txs
            for (let y = 0; y < txs.length; y++) {
                if (txs[y].hash == tx.hash)
                    return true
            }
        }
        return false
    },
    isValid: (tx, ts, cb) => {
        if (!tx.sender || !tx.hash || !tx.signature || !tx.ts) {
            console.log('missing required variable')
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
            var bandwidth = new GrowInt(legitUser.bw, {growth:legitUser.balance/(60000)})
            var needed_bytes = JSON.stringify(tx).length;
            if (bandwidth.grow(ts).v < needed_bytes) {
                console.log('not enough bandwidth')
                cb(false); return
            }

            // check transaction specifics
            switch (tx.type) {
                case TransactionType.NEW_ACCOUNT:
                    if (!tx.data.name
                    || !tx.data.pub
                    || tx.sender != 'master') {
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
                    if (!tx.data.target) {
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
                    if (!tx.data.target) {
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
                    if (!tx.data.receiver
                    || !tx.data.amount) {
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

                default:
                    cb(false)
                    break;
            }
        })
    },
    execute: (tx, ts, cb) => {
        transaction.collectBandwidth(tx, ts, function(success) {
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
                            transaction.updateBandwidth(acc, ts, function(success) {
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
                                            transaction.updateBandwidth(acc, ts, function(success) {
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
    
                default:
                    cb(false)
                    break;
            }
        })

    },
    collectBandwidth: (tx, ts, cb) => {
        db.collection('accounts').findOne({name: tx.sender}, function(err, account) {
            var bandwidth = new GrowInt(account.bw, {growth:account.balance/(60000)})
            var needed_bytes = JSON.stringify(tx).length;
            var bw = bandwidth.grow(ts)
            bw.v -= needed_bytes
            db.collection('accounts').updateOne({name: account.name}, {$set: {bw: bw}}, function(err) {
                if (err) throw err;
                cb(true)
            })
        })
    },
    updateBandwidth: (account, ts, cb) => {
        var bandwidth = new GrowInt(account.bw, {growth:account.balance/(60000)})
        var bw = bandwidth.grow(ts)
        db.collection('accounts').updateOne({name: account.name}, {$set: {bw: bw}}, function(err) {
            if (err) throw err;
            cb(true)
        })
    }
}

module.exports = transaction