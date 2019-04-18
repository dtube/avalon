module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }
        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', {name: tx.sender}, {$set: {pub: tx.data.pub}}, function() {
            cb(true)
        })
    }
}