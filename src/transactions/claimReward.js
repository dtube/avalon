module.exports = {
    fields: ['link', 'author'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            logr.debug('invalid tx data.author')
            cb(false); return
        }
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        // checking if content exists
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
            if (!content) {
                cb(false, 'invalid tx non-existing content'); return
            }

            // checking if the vote from user exists
            for (let i = 0; i < content.votes.length; i++)
                if (content.votes[i].u === tx.sender) {
                    if (content.votes[i].claimed) {
                        cb(false, 'invalid tx reward already claimed'); return
                    }
                    if (content.votes[i].claimable < 1) {
                        cb(false, 'reward too low to be claimed'); return
                    }
                    if (ts - content.votes[i].ts < config.ecoClaimTime) {
                        cb(false, 'too early to claim reward'); return
                    }
                    
                    cb(true)
                    return
                }
            
            cb(false, 'invalid tx non-existing vote')
        })
    },
    execute: (tx, ts, cb) => {
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
            for (let i = 0; i < content.votes.length; i++)
                if (content.votes[i].u === tx.sender) {
                    let reward = Math.floor(content.votes[i].claimable)
                    content.votes[i].claimed = ts
                    cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link}, {
                        $set: {votes: content.votes}
                    }, function() {
                        cache.updateOne('accounts', {name: tx.sender}, {
                            $inc: {balance: reward, claimedReward: reward}
                        }, function() {
                            cache.insertOne('distributed', {
                                name: tx.sender,
                                dist: reward,
                                ts: ts,
                                _id: content.author+'/'+content.link+'/claim/'+tx.sender
                            }, function() {
                                cache.findOne('accounts', {name: tx.sender}, function(err, curator) {
                                    if (err) throw err
                                    // update his bandwidth
                                    curator.balance -= reward
                                    transaction.updateGrowInts(curator, ts, function() {
                                        transaction.adjustNodeAppr(curator, reward, function() {
                                            cb(true)
                                        })
                                    })
                                })
                            })
                        })
                    })
                    return
                }
        })
    }
}