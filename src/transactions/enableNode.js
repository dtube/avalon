module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        // we don't need to validate anything here
        cb(true)
    },
    execute: (tx, ts, cb) => {
        // because if key is incorrect, we just null it
        var leaderKey = null
        if (validate.publicKey(tx.data.pub, config.accountMaxLength))
            leaderKey = tx.data.pub

        cache.updateOne('accounts', {
            name: tx.sender
        },{ $set: {
            leaderKey: leaderKey
        }}, function(){
            cb(true)
        })
    }
}