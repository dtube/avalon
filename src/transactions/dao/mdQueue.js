const dao = require('../../dao')
const daoMaster = require('../../daoMaster')

module.exports = {
    bsonValidate: true,
    fields: ['txtype','payload'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')
        if (!config.masterDao)
            return cb(false, 'master dao controller is not active')
        
        // tx type integer
        if (!validate.integer(tx.data.txtype,true,false))
            return cb(false, 'invalid txtype integer')

        // tx payload
        if (!validate.json(tx.data.payload))
            return cb(false, 'invalid tx payload')

        // dao member
        if (!dao.leaderSnapshot().includes(tx.sender))
            return cb(false, 'sender not a dao member')

        // validate payload and callback
        daoMaster.validateOperation(tx.data.txtype,tx.data.payload,ts,cb)
    },
    execute: async (tx, ts, cb) => {
        cache.insertOne('masterdao',{
            _id: daoMaster.nextID,
            type: tx.data.txtype,
            data: tx.data.payload,
            ts: ts,
            expiration: ts+config.masterDaoTxExp,
            snapshot: dao.leaderSnapshot(),
            signers: [tx.sender]
        },() => {
            daoMaster.incrementID()
            cb(true)
        })
    }
}