module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        // we don't need to validate anything here
        cb(true)
    },
    execute: (tx, ts, cb) => {
        // because if key is incorrect, we just unset it
        if (validate.publicKey(tx.data.pub, config.accountMaxLength))
            cache.updateOne('accounts', {
                name: tx.sender
            },{ $set: {
                pub_leader: tx.data.pub
            }}, function(){
                cache.addLeader(tx.sender,false,() => cb(true))
            })
        else
            cache.updateOne('accounts', {
                name: tx.sender
            },{ $unset: {
                pub_leader: ''
            }}, function(){
                cache.removeLeader(tx.sender)
                cb(true)
            })
    }
}