const dao = require('../../dao')
const cc = require('../../validate').chainConfig

module.exports = {
    bsonValidate: true,
    fields: ['title', 'description', 'url', 'changes'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        // proposal metadata
        if (!validate.string(tx.data.title, config.memoMaxLength))
            return cb(false, 'invalid proposal title string')

        if (!validate.string(tx.data.description, config.jsonMaxBytes))
            return cb(false, 'invalid proposal description string')

        if (!validate.string(tx.data.url, config.memoMaxLength))
            return cb(false, 'invalid proposal url string')

        // chain update details
        if (!validate.array(tx.data.changes,config.chainUpdateMaxParams))
            return cb(false, 'invalid chain update changes array')

        // array of two-element arrays specifying parameter name and value
        let changesObj = {}
        let groupChanges = []
        for (let p in tx.data.changes)
            if (!validate.array(tx.data.changes[p]) || tx.data.changes[p].length !== 2 || !validate.string(tx.data.changes[p][0]))
                return cb(false, 'invalid chain update change #'+p)
            else if (!cc.parameters[tx.data.changes[p][0]])
                return cb(false, 'invalid chain parameter key #'+p)
            else if (!cc.parameters[tx.data.changes[p][0]](tx.data.changes[p][1]))
                return cb(false, 'invalid chain parameter '+tx.data.changes[p][0]+' value')
            else if (changesObj[tx.data.changes[p][0]])
                return cb(false, 'duplicate chain parameter '+tx.data.changes[p][0])
            else
                changesObj[tx.data.changes[p][0]] = tx.data.changes[p][1]
        
        // check for group changes that must be bundled together in the proposal
        for (let p in changesObj)
            if (cc.groupsInv[p] && !groupChanges.includes(cc.groupsInv[p])) {
                for (let member in cc.groups[cc.groupsInv[p]].members)
                    if (!changesObj[cc.groups[cc.groupsInv[p]].members[member]])
                        return cb(false, 'incomplete parameter group '+cc.groupsInv[p])
                groupChanges.push(cc.groupsInv[p])
            }
        
        // validate parameter values as a group
        for (let g in groupChanges) {
            let memberValues = []
            for (let p in cc.groups[groupChanges[g]].members)
                memberValues.push(changesObj[cc.groups[groupChanges[g]].members[p]])
            if (!cc.groups[groupChanges[g]].validate(...memberValues))
                return cb(false, 'validation failed for parameter values in group '+groupChanges[g])
        }

        let creator = await cache.findOnePromise('accounts',{ name: tx.sender })
        let fee = config.chainUpdateFee
        if (dao.availableBalance(creator,ts) < fee)
            return cb(false, 'insufficient balance for proposal creation fee of '+(fee/100)+' DTUBE')

        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.insertOne('proposals', {
            _id: dao.nextID,
            type: dao.governanceTypes.chainUpdate,
            title: tx.data.title,
            description: tx.data.description,
            url: tx.data.url,
            creator: tx.sender,
            changes: tx.data.changes,
            fee: config.chainUpdateFee,
            approvals: 0,
            disapprovals: 0,
            status: 0,
            state: dao.proposalState.active,
            ts: ts,
            votingEnds: ts+(config.daoVotingPeriodSeconds*1000),
            leaderSnapshot: dao.leaderSnapshot()
        }, async () => {
            dao.incrementID(ts)
            // deduct fee
            let sender = await cache.findOnePromise('accounts', {name: tx.sender})
            await cache.updateOnePromise('accounts', {name: tx.sender}, {$inc: {balance: -config.chainUpdateFee}})
            await transaction.updateIntsAndNodeApprPromise(sender, ts, -config.chainUpdateFee)
            cb(true)
        })
    }
}