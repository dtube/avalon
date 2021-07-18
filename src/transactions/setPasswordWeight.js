module.exports = {
    fields: ['weight'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.multisig)
            cb(false, 'multisig is disabled')
        else if (!validate.integer(tx.data.weight,false,false))
            cb(false, 'invalid tx data.weight must be a positive integer')
        else
            cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', {name: tx.sender}, {$set: {pub_weight: tx.data.weight}}, () => cb(true))
    }
}