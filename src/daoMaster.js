// dao controller for master account
let transactions

let daoMaster = {
    validateOperation: (type,data,ts,cb) => {
        if (!config.masterDaoTxs.includes(type))
            return cb(false, 'master dao account cannot transact with this tx type')
        let op = {
            type: type,
            data: data,
            sender: config.masterName,
            ts: ts
        }
        cache.findOne('accounts',{name: config.masterName},(e,acc) => transactions.validate(op,ts,acc,cb))
    },
    executeOperation: (operation,ts) => {
        return new Promise(async (rs) => {
            let adj = await daoMaster.adjustOperation(operation)
            // revalidate, error if invalid at time of execution
            daoMaster.validateOperation(operation.type,operation.data,ts,(isvalid,em) => {
                if (isvalid)
                    transactions.execute({
                        type: operation.type,
                        data: operation.data,
                        sender: config.masterName,
                        ts: ts
                    },ts,() => cache.updateOne('masterdao',{_id: operation._id},{$set: { executed: ts, adjustments: adj }},() => rs(true)))
                else
                    cache.updateOne('masterdao',{_id: operation._id},{$set: { executed: ts, error: em }},() => rs(true))
            })
        })
    },
    adjustOperation: async (operation) => {
        let adjustments = {}
        if (operation.type === transactions.Types.FUND_REQUEST_CONTRIB) {
            // adjust contribution amount so that it does not exceed max requested
            let prop = await cache.findOnePromise('proposals',{_id: operation.data.id})
            if (operation.data.amount > prop.requested - prop.raised) {
                operation.data.amount = prop.requested - prop.raised
                adjustments = operation.data.amount
            }
        }
        return adjustments
    },
    getThreshold: (operation) => {
        let snapshotLength = operation.snapshot.length
        return Math.ceil((snapshotLength*2)/3)
    },
    loadID: async () => {
        let latestOperation = await db.collection('masterdao').find({},{sort: {_id:-1},limit:1}).toArray()
        if (latestOperation && latestOperation.length > 0) {
            daoMaster.lastID = latestOperation[0]._id
            daoMaster.nextID = daoMaster.lastID+1
        }
        transactions = require('./transactions')
    },
    incrementID: () => {
        daoMaster.nextID++
    },
    resetID: () => {
        daoMaster.nextID = daoMaster.lastID+1
    },
    nextBlock: () => {
        daoMaster.lastID = daoMaster.nextID-1
    },
    nextID: 1,
    lastID: 0,
}

module.exports = daoMaster