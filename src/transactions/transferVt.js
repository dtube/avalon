module.exports = {
    fields: ['receiver', 'amount'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        }
        let vpCheck = transaction.notEnoughVP(tx.data.amount, ts, legitUser)
        if (vpCheck.needs)
            return cb(false, 'not enough VP, attempting to spend '+tx.data.amount+' VP but only has '+vpCheck.has+' VP')
        cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
            if (err) throw err
            if (!account) cb(false, 'invalid tx receiver does not exist')
            else cb(true)
        })
        
    },
    execute: (tx, ts, cb) => {
        if (config.burnAccountIsBlackhole && tx.data.receiver === config.burnAccount)
            return cb(true)
        cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
            if (err) throw err
            account.vt.v += tx.data.amount
            cache.updateOne('accounts', {name: tx.data.receiver}, {$set: {vt: account.vt}}, function() {
                cb(true)
            })
        })
    }
}