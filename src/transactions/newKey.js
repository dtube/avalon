module.exports = {
    bsonValidate: true,
    fields: ['id', 'pub', 'types'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.id, config.keyIdMaxLength)) {
            cb(false, 'invalid tx data.id'); return
        }

        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }
        if (!validate.array(tx.data.types)) {
            cb(false, 'invalid tx data.types'); return
        }
        for (let i = 0; i < tx.data.types.length; i++) 
            if (!Number.isInteger(tx.data.types[i])) {
                cb(false, 'invalid tx all types must be integers'); return
            }
        
        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (!account)
                cb(false, 'invalid tx sender does not exist')
            else if (!account.keys)
                cb(true)
            else if (config.maxKeys && account.keys.length >= config.maxKeys)
                cb(false, 'cannot add more than ' + config.maxKeys + ' custom keys')
            else {
                for (let i = 0; i < account.keys.length; i++) 
                    if (account.keys[i].id === tx.data.id) {
                        cb(false, 'invalid tx data.id already exists'); return
                    }
                
                cb(true)
            }
        })
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', {
            name: tx.sender
        },{ $push: {
            keys: tx.data
        }},function(){
            cb(true)
        })
    }
}