module.exports = {
    fields: ['receiver', 'amount', 'asset', 'memo'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        }
        if (!validate.string(tx.data.memo, config.memoMaxLength)) {
            cb(false, 'invalid tx data.memo'); return
        }
        if (!validate.string(tx.data.asset, config.assetMaxLength)) {
            cb(false, 'invalid tx data.asset'); return
        }
        if (tx.data.receiver === tx.sender) {
            cb(false, 'invalid tx cannot send to self'); return
        }

        // master mints tokens
        if (tx.sender === config.masterName) {
            cb(true)
            return
        }

        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (err) throw err
            if (!account['asset_'+tx.data.asset] || account['asset_'+tx.data.asset] < tx.data.amount) {
                cb(false, 'invalid tx not enough '+tx.data.asset+' balance'); return
            }
            cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                if (err) throw err
                if (!account) cb(false, 'invalid tx receiver does not exist')
                else cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        // add funds to receiver
        var inc = {}
        inc['asset_'+tx.data.asset] = tx.data.amount
        cache.updateOne('accounts', 
            {name: tx.data.receiver},
            {$inc: inc},
            function() {
                if (tx.sender === config.masterName) {
                    cb(true)
                    return
                }
                
                // remove funds from sender
                inc['asset_'+tx.data.asset] = -tx.data.amount
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$inc: inc},
                    function() {
                        cb(true)
                    }
                )
            })
        
    }
}