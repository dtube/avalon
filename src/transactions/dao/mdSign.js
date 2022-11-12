const daoMaster = require('../../daoMaster')

module.exports = {
    bsonValidate: true,
    fields: ['id'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')
        if (!config.masterDao)
            return cb(false, 'master dao controller is not active')

        // infinite loop failsafe
        if (tx.sender === config.masterName)
            return cb(false, 'master account must not execute itself')

        // tx type integer
        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid operation id')

        let op = await cache.findOnePromise('masterdao',{_id: tx.data.id})
        if (!op)
            return cb(false, 'operation does not exist')

        // dao member
        if (!op.snapshot.includes(tx.sender))
            return cb(false, 'sender not a dao member as of snapshot')

        // yet to be executed
        if (op.executed)
            return cb(false, 'operation already executed')

        // not signed yet
        if (op.signers.includes(tx.sender))
            return cb(false, 'already signed operation')

        // not expired
        if (ts > op.expiration)
            return cb(false, 'operation already expired')

        cb(true)
    },
    execute: async (tx, ts, cb) => {
        await cache.updateOnePromise('masterdao',{_id: tx.data.id},{ $push: { signers: tx.sender }})
        let op = await cache.findOnePromise('masterdao',{_id: tx.data.id})
        if (op.signers.length >= daoMaster.getThreshold(op))
            await daoMaster.executeOperation(op,ts)
        cb(true)
    }
}