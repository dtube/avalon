var GrowInt = require('growint')

module.exports = {
    fields: ['receiver', 'amount'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
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
    },
    execute: (tx, ts, cb) => {

    }
}