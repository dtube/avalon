module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        // we don't need to validate anything here
        cb(true)
    },
    execute: (tx, ts, cb) => {
        // because if key is incorrect, we just null it
        var pub_leader = null
        if (validate.publicKey(tx.data.pub, config.accountMaxLength))
            pub_leader = tx.data.pub

        cache.updateOne('accounts', {
            name: tx.sender
        },{ $set: {
            pub_leader: pub_leader
        }}, function(){
            cb(true)
        })
    }
}