module.exports = {
    fields: ['id'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.id, config.keyIdMaxLength)) {
            cb(false, 'invalid tx data.id'); return
        }
        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (!account) {
                cb(false, 'invalid tx sender does not exist'); return
            }
            if (!account.keys) {
                cb(false, 'invalid tx could not find key'); return
            } else {
                for (let i = 0; i < account.keys.length; i++) 
                    if (account.keys[i].id === tx.data.id) {
                        cb(true); return
                    }
                
                cb(false, 'invalid tx could not find key')
            }
        })
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', {
            name: tx.sender
        },{ $pull: {
            keys: tx.data
        }},function(){
            cb(true)
        })
    }
}