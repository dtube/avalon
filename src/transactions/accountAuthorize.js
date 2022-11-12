module.exports = {
    bsonValidate: true,
    fields: ['user','id','types','weight'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.accountAuthEnabled)
            return cb(false, 'account auth is disabled')

        if (!validate.string(tx.data.user, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid authorized username')

        if (!validate.string(tx.data.id, config.keyIdMaxLength))
            return cb(false, 'invalid authorized key id')

        if (!validate.array(tx.data.types))
            return cb(false, 'invalid tx types array')

        for (let i = 0; i < tx.data.types.length; i++)
            if (!Number.isInteger(tx.data.types[i]))
                return cb(false, 'invalid tx all types must be integers')

        if (!validate.integer(tx.data.weight,false,false))
            return cb(false, 'invalid tx data.weight must be a positive integer')

        cache.findOne('accounts', {name: tx.data.user}, (e,authorizedAcc) => {
            if (!authorizedAcc)
                return cb(false, 'authorized account does not exist')
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (!account)
                    return cb(false, 'invalid tx sender does not exist')
                else if (config.maxKeys && account.auths && account.auths.length >= config.maxKeys)
                    return cb(false, 'cannot add more than ' + config.maxKeys + ' account auths')
                else if (account.auths)
                    for (let i in account.auths)
                        if (account.auths[i].user === tx.data.user && account.auths[i].id === tx.data.id)
                            return cb(false, 'account auth already exist')
                cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', { name: tx.sender },{ $push: { auths: tx.data }}, () => cb(true))
    }
}