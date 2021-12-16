module.exports = {
    fields: ['types'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.multisig)
            return cb(false, 'multisig is disabled')
        
        if (!validate.array(tx.data.types))
            return cb(false, 'types is not a valid array')
        
        for (let t in tx.data.types)
            if (!validate.integer(tx.data.types[t],true,false))
                return cb(false, 'invalid type ' + tx.data.types[t] + ' at index ' + t)
        
        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, (e,acc) => {
            let newThresholds = acc.thresholds
            if (newThresholds) {
                for (let t in tx.data.types)
                    delete newThresholds[tx.data.types[t]]
                cache.updateOne('accounts', {name: tx.sender}, { $set: { thresholds: newThresholds } }, () => cb(true))
            } else
                cb(true)
        })
    }
}