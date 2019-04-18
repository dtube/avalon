module.exports = {
    fields: ['name', 'pub'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.name, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.name'); return
        }
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
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
    },
    execute: (tx, ts, cb) => {

    }
}