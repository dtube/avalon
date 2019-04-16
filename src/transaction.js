var GrowInt = require('./growInt.js')
var eco = require('./economics.js')
var TransactionType = require('./transactionType.js')

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
        if (typeof tx.type !== 'number' || tx.type < 0 || tx.type > Number.MAX_SAFE_INTEGER) {
            cb(false, 'invalid tx type'); return
        }
        if (!tx.data || typeof tx.data !== 'object') {
            cb(false, 'invalid tx data'); return
        }
        if (!tx.sender || typeof tx.sender !== 'string') {
            cb(false, 'invalid tx sender'); return
        }
        if (!tx.ts || typeof tx.ts !== 'number' || tx.ts < 0 || tx.ts > Number.MAX_SAFE_INTEGER) {
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
        switch (tx.type) {
        case TransactionType.NEW_ACCOUNT:
            if (!tx.data.name || typeof tx.data.name !== 'string' || tx.data.name.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.name'); return
            }
            if (!tx.data.pub || typeof tx.data.pub !== 'string' || tx.data.pub.length > config.accountMaxLength || !chain.isValidPubKey(tx.data.pub)) {
                cb(false, 'invalid tx data.pub'); return
            }

            var lowerUser = tx.data.name.toLowerCase()

            for (let i = 0; i < lowerUser.length; i++) {
                const c = lowerUser[i]
                // allowed username chars
                if (config.allowedUsernameChars.indexOf(c) === -1) 
                    if (config.allowedUsernameCharsOnlyMiddle.indexOf(c) === -1) {
                        cb(false, 'invalid tx data.name char '+c); return
                    } else if (i === 0 || i === lowerUser.length-1) {
                        cb(false, 'invalid tx data.name char '+c+' can only be in the middle'); return
                    }
                
            }

            cache.findOne('accounts', {name: lowerUser}, function(err, account) {
                if (err) throw err
                if (account)
                    cb(false, 'invalid tx data.name already exists')
                else if (tx.data.name !== tx.data.pub) 
                    // if it's not a free account, check tx sender balance
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (err) throw err
                        if (account.balance < eco.accountPrice(lowerUser))
                            cb(false, 'invalid tx not enough balance')
                        else
                            cb(true)
                    })
                else cb(true)
            })
            break
            

        case TransactionType.APPROVE_NODE_OWNER:
            if (!tx.data.target || typeof tx.data.target !== 'string' || tx.data.target.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.target'); return
            }

            cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                if (err) throw err
                if (!acc.approves) acc.approves = []
                if (acc.approves.indexOf(tx.data.target) > -1) {
                    cb(false, 'invalid tx already voting'); return
                }
                if (acc.approves.length >= config.leaderMaxVotes)
                    cb(false, 'invalid tx max votes reached')
                else 
                    cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                        if (!account) 
                            cb(false, 'invalid tx target does not exist')
                        else 
                            cb(true)
                        
                    })
                
            })
            break

        case TransactionType.DISAPROVE_NODE_OWNER:
            if (!tx.data.target || typeof tx.data.target !== 'string' || tx.data.target.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.target'); return
            }

            cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                if (err) throw err
                if (!acc.approves) acc.approves = []
                if (acc.approves.indexOf(tx.data.target) === -1) {
                    cb(false, 'invalid tx already unvoted'); return
                }
                cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                    if (!account) 
                        cb(false, 'invalid tx target does not exist')
                    else 
                        cb(true)
                    
                })
            })
            break

        case TransactionType.TRANSFER:
            if (!tx.data.receiver || typeof tx.data.receiver !== 'string' || tx.data.receiver.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.receiver'); return
            }
            if (!tx.data.amount || typeof tx.data.amount !== 'number' || tx.data.amount < 1 || tx.data.amount > Number.MAX_SAFE_INTEGER) {
                cb(false, 'invalid tx data.amount'); return
            }
            if (typeof tx.data.memo !== 'string' || tx.data.memo.length > config.memoMaxLength) {
                cb(false, 'invalid tx data.memo'); return
            }
            if (tx.data.amount !== Math.floor(tx.data.amount)) {
                cb(false, 'invalid tx data.amount not an integer'); return
            }
            if (tx.data.receiver === tx.sender) {
                cb(false, 'invalid tx cannot send to self'); return
            }

            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                if (account.balance < tx.data.amount) {
                    cb(false, 'invalid tx not enough balance'); return
                }
                cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                    if (err) throw err
                    if (!account) cb(false, 'invalid tx receiver does not exist')
                    else cb(true)
                })
            })
            break

        case TransactionType.COMMENT:
            // permlink
            if (!tx.data.link || typeof tx.data.link !== 'string' || tx.data.link.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.link'); return
            }
            // parent author
            if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pa !== 'string' || tx.data.pa.length > config.accountMaxLength)) {
                cb(false, 'invalid tx data.pa'); return
            }
            // parent permlink
            if ((tx.data.pa && tx.data.pp) && (typeof tx.data.pp !== 'string' || tx.data.pp.length > config.accountMaxLength)) {
                cb(false, 'invalid tx data.pp'); return
            }
            // handle arbitrary json input
            if (!tx.data.json || typeof tx.data.json !== 'object' || JSON.stringify(tx.data.json).length > config.jsonMaxBytes) {
                cb(false, 'invalid tx data.json'); return
            }
            // users need to vote the content at the same time with vt and tag field
            if (!tx.data.vt || typeof tx.data.vt !== 'number' || tx.data.vt < Number.MIN_SAFE_INTEGER || tx.data.vt > Number.MAX_SAFE_INTEGER) {
                cb(false, 'invalid tx data.vt'); return
            }
            if (tx.data.tag && (typeof tx.data.tag !== 'string' || tx.data.tag.length > config.tagMaxLength)) {
                cb(false, 'invalid tx data.tag'); return
            }
            // checking if they have enough VTs
            var vtBeforeComment = new GrowInt(legitUser.vt, {growth:legitUser.balance/(config.vtGrowth)}).grow(ts)
            if (vtBeforeComment.v < Math.abs(tx.data.vt)) {
                cb(false, 'invalid tx not enough vt'); return
            }

            if (tx.data.pa && tx.data.pp) 
                // its a comment of another comment
                cache.findOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, function(err, content) {
                    if (!content) {
                        cb(false, 'invalid tx parent comment does not exist'); return
                    }
                    cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                        if (content) {
                            // user is editing an existing comment
                            if (content.pa !== tx.data.pa || content.pp !== tx.data.pp) {
                                cb(false, 'invalid tx parent comment cannot be edited'); return
                            }
                        } else 
                            // it is a new comment
                            cb(true)
                        
                    })
                })
            else 
                cb(true)
            

            break

        case TransactionType.VOTE:
            if (!tx.data.author || typeof tx.data.author !== 'string' || tx.data.author.length > config.accountMaxLength) {
                logr.debug('invalid tx data.author')
                cb(false); return
            }
            if (!tx.data.link || typeof tx.data.link !== 'string' || tx.data.link.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.link'); return
            }
            if (!tx.data.vt || typeof tx.data.vt !== 'number' || tx.data.vt < Number.MIN_SAFE_INTEGER || tx.data.vt > Number.MAX_SAFE_INTEGER) {
                cb(false, 'invalid tx data.vt'); return
            }
            if (tx.data.tag && (typeof tx.data.tag !== 'string' || tx.data.tag.length > config.tagMaxLength)) {
                cb(false, 'invalid tx data.tag'); return
            }
            var vtBeforeVote = new GrowInt(legitUser.vt, {growth:legitUser.balance/(config.vtGrowth)}).grow(ts)
            if (vtBeforeVote.v < Math.abs(tx.data.vt)) {
                cb(false, 'invalid tx not enough vt'); return
            }
            // checking if content exists
            cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
                if (!content) {
                    cb(false, 'invalid tx non-existing content'); return
                }
                if (!config.allowRevotes) 
                    for (let i = 0; i < content.votes.length; i++) 
                        if (tx.sender === content.votes[i].u) {
                            cb(false, 'invalid tx user has already voted'); return
                        }
                    
                
                cb(true)
            })
            break

        case TransactionType.USER_JSON:
            // handle arbitrary json input
            if (!tx.data.json || typeof tx.data.json !== 'object' || JSON.stringify(tx.data.json).length > config.jsonMaxBytes) {
                cb(false, 'invalid tx data.json'); return
            }
            cb(true)
            break

        case TransactionType.FOLLOW:
            if (!tx.data.target || typeof tx.data.target !== 'string' || tx.data.target.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.target'); return
            }

            cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                if (err) throw err
                if (!acc.follows) acc.follows = []
                if (acc.follows.indexOf(tx.data.target) > -1) {
                    cb(false, 'invalid tx already following'); return
                }
                if (acc.follows.length >= config.followsMax)
                    cb(false, 'invalid tx reached max follows')
                else 
                    cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                        if (!account) 
                            cb(false, 'invalid tx target does not exist')
                        else 
                            cb(true)
                        
                    })
                
            })
            break

        case TransactionType.UNFOLLOW:
            if (!tx.data.target || typeof tx.data.target !== 'string' || tx.data.target.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.target'); return
            }

            cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                if (err) throw err
                if (!acc.follows) acc.follows = []
                if (acc.follows.indexOf(tx.data.target) === -1) {
                    cb(false, 'invalid tx not following target'); return
                }
                cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                    if (!account) 
                        cb(false, 'invalid tx target does not exist')
                    else 
                        cb(true)
                    
                })
            })
            break

        case TransactionType.NEW_KEY:
            if (!tx.data.id || typeof tx.data.id !== 'string' || tx.data.id.length > config.keyIdMaxLength) {
                cb(false, 'invalid tx data.id'); return
            }
            if (!tx.data.pub || typeof tx.data.pub !== 'string' || tx.data.pub.length > config.accountMaxLength || !chain.isValidPubKey(tx.data.pub)) {
                cb(false, 'invalid tx data.pub'); return
            }
            if (!tx.data.types || !Array.isArray(tx.data.types) || tx.data.types.length < 1) {
                cb(false, 'invalid tx data.types'); return
            }
            for (let i = 0; i < tx.data.types.length; i++) 
                if (!Number.isInteger(tx.data.types[i])) {
                    cb(false, 'invalid tx all types must be integers'); return
                }
            
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (!account) {
                    cb(false, 'invalid tx sender does not exist'); return
                }
                if (!account.keys) {
                    cb(true); return
                } else {
                    for (let i = 0; i < account.keys.length; i++) 
                        if (account.keys[i].id === tx.data.id) {
                            cb(false, 'invalid tx data.id already exists'); return
                        }
                    
                    cb(true)
                }
            })
            break

        case TransactionType.REMOVE_KEY:
            if (!tx.data.id || typeof tx.data.id !== 'string' || tx.data.id.length > config.keyIdMaxLength) {
                cb(false, 'invalid tx data.id'); return
            }
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (!account) {
                    cb(false, 'invalid tx sender does not exist'); return
                }
                if (!account.keys) {
                    cb(false, 'invalid tx could not find key'); return
                } else {
                    for (let i = 0; i < account.keys.length; i++) 
                        if (account.keys[i].id === tx.data.id) {
                            cb(true); return
                        }
                    
                    cb(false, 'invalid tx could not find key')
                }
            })
            break
            
        case TransactionType.CHANGE_PASSWORD:
            if (!tx.data.pub || typeof tx.data.pub !== 'string' || tx.data.pub.length > config.accountMaxLength || !chain.isValidPubKey(tx.data.pub)) {
                cb(false, 'invalid tx data.pub'); return
            }
            cb(true)
            break
        
        case TransactionType.PROMOTED_COMMENT:
            // first verify that the user isn't editing an existing content
            if (!tx.data.link || typeof tx.data.link !== 'string' || tx.data.link.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.link'); return
            }
            cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                if (err) throw err
                if (content) {
                    cb(false, 'cannot edit and promote'); return
                }
                // then verify that the same comment without promotion would be ok
                var comment = {
                    type: TransactionType.COMMENT,
                    data: Object.assign({}, tx.data)
                }
                delete comment.data.burn
                transaction.isValidTxData(comment, ts, legitUser, function(isValid, error) {
                    if (isValid) {
                        // and checking if user has enough coins to burn
                        if (!tx.data.burn || typeof tx.data.burn !== 'number' || tx.data.burn < 1 || tx.data.burn > Number.MAX_SAFE_INTEGER) {
                            cb(false, 'invalid tx data.burn'); return
                        }
                        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                            if (err) throw err
                            if (account.balance < tx.data.burn) {
                                cb(false, 'invalid tx not enough balance to burn'); return
                            }
                            cb(true)
                        })
                    } else
                        cb(isValid, error)
                })
            })
            break
        
        case TransactionType.TRANSFER_VT:
            if (!tx.data.receiver || typeof tx.data.receiver !== 'string' || tx.data.receiver.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.receiver'); return
            }
            if (!tx.data.amount || typeof tx.data.amount !== 'number' || tx.data.amount < 1 || tx.data.amount > Number.MAX_SAFE_INTEGER) {
                cb(false, 'invalid tx data.amount'); return
            }
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                var vtBefore = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
                if (vtBefore.v < Math.abs(tx.data.vt)) {
                    cb(false, 'invalid tx not enough vt'); return
                }
                cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                    if (err) throw err
                    if (!account) cb(false, 'invalid tx receiver does not exist')
                    else cb(true)
                })
            })
            break

        case TransactionType.TRANSFER_BW:
            if (!tx.data.receiver || typeof tx.data.receiver !== 'string' || tx.data.receiver.length > config.accountMaxLength) {
                cb(false, 'invalid tx data.receiver'); return
            }
            if (!tx.data.amount || typeof tx.data.amount !== 'number' || tx.data.amount < 1 || tx.data.amount > Number.MAX_SAFE_INTEGER) {
                cb(false, 'invalid tx data.amount'); return
            }
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                var bwBefore = new GrowInt(account.vt, {growth:account.balance/(config.vtGrowth)}).grow(ts)
                if (bwBefore.v < Math.abs(tx.data.vt)) {
                    cb(false, 'invalid tx not enough vt'); return
                }
                cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                    if (err) throw err
                    if (!account) cb(false, 'invalid tx receiver does not exist')
                    else cb(true)
                })
            })
            break

        default:
            cb(false, 'invalid tx unknown transaction type')
            break
        }
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