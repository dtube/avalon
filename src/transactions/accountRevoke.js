module.exports = {
    fields: ['user','id'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.accountAuthEnabled)
            return cb(false, 'account auth is disabled')

        if (!validate.string(tx.data.user, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid authorized username')

        if (!validate.string(tx.data.id, config.keyIdMaxLength))
            return cb(false, 'invalid authorized key id')

        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (!account)
                return cb(false, 'account does not exist')
            else if (!account.auths)
                return cb(false, 'account auth does not exist')
            else {
                for (let i = 0; i < account.auths.length; i++) 
                    if (account.auths[i].user === tx.data.user && account.auths[i].id === tx.data.id)
                        return cb(true)
                
                return cb(false, 'account auth does not exist')
            }
        })
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', { name: tx.sender },{ $pull: { auths: tx.data }}, () => cb(true))
    }
}