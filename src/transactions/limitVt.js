module.exports = {
    fields: ['amount'],
    validate: (tx, ts, legitUser, cb) => {
        var amount = tx.data.amount || Number.MAX_SAFE_INTEGER
        if (!validate.integer(amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        } else
            cb(true)
    },
    execute: (tx, ts, cb) => {
        var amount = tx.data.amount || Number.MAX_SAFE_INTEGER
        cache.updateOne('accounts', {
            name: tx.sender
        },{ $set: {
            maxVt: amount
        }},function(){
            cb(true)
        })
    }
}