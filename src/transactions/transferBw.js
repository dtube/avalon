const GrowInt = require('growint')

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
            let bwBefore = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth)}).grow(ts)
            if (bwBefore.v < tx.data.amount) {
                cb(false, 'invalid tx not enough bw'); return
            }
            cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                if (err) throw err
                if (!account) cb(false, 'invalid tx receiver does not exist')
                else cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        if (config.burnAccountIsBlackhole && tx.data.receiver === config.burnAccount)
            return cb(true)
        cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
            if (err) throw err
            account.bw.v += tx.data.amount
            cache.updateOne('accounts', {name: tx.data.receiver}, {$set: {bw: account.bw}}, function() {
                cb(true)
            })
        })
    }
}