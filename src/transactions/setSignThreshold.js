module.exports = {
    fields: ['thresholds'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.multisig)
            return cb(false, 'multisig is disabled')
        
        if (!validate.json(tx.data.thresholds,config.jsonMaxBytes))
            return cb(false, 'invalid tx data.threshold json')
        
        for (let t in tx.data.thresholds) {
            if (t !== 'default' && (t !== parseInt(t).toString() || !validate.integer(parseInt(t),true,false)))
                return cb(false, 'invalid tx type ' + t)

            if (!validate.integer(tx.data.thresholds[t],false,false,Number.MAX_SAFE_INTEGER,1))
                return cb(false, 'invalid threshold for tx type ' + t)
        }
        
        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, (e,acc) => {
            cache.updateOne('accounts', {name: tx.sender}, {
                $set: {
                    thresholds: !acc.thresholds ? tx.data.thresholds : Object.assign(acc.thresholds,tx.data.thresholds)
                }
            }, () => cb(true))
        })
    }
}