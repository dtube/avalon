module.exports = {
    bsonValidate: true,
    fields: ['id', 'pub', 'types', 'weight'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.multisig)
            return cb(false, 'multisig is disabled')

        // validate key weight
        if (!validate.integer(tx.data.weight,false,false))
            return cb(false, 'invalid tx data.weight must be a positive integer')

        // other validations are the same as NEW_KEY
        require('./newKey').validate(tx,ts,legitUser,cb)
    },
    execute: (tx, ts, cb) => {
        // same as NEW_KEY
        cache.updateOne('accounts', {
            name: tx.sender
        },{ $push: {
            keys: tx.data
        }},function(){
            cb(true)
        })
    }
}