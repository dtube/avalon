const dao = require('../../dao')

module.exports = {
    fields: ['requested', 'receiver', 'json', 'deadline'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        // total amount requested
        if (!validate.integer(tx.data.requested,false,false))
            return cb(false, 'invalid requested amount')

        // proposal fund beneficiary
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid proposal funding receiver')

        // proposal json metadata
        if (!validate.json(tx.data.json, config.jsonMaxBytes))
            return cb(false, 'invalid proposal json metadata')

        // proposal job deadline
        let minDeadline = ts+(config.daoVotingPeriodSeconds*1000)+(config.fundRequestContribPeriodSeconds*1000)
        let maxDeadline = minDeadline+(config.fundRequestDeadlineSeconds*1000)
        if (!validate.integer(tx.data.deadline,false,false,maxDeadline,minDeadline))
            return cb(false, 'invalid proposal deadline')

        let creator = await cache.findOnePromise('accounts',{ name: tx.sender })
        let receipient = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        let fee = dao.proposalCreationFee(tx.data.requested)
        if (!receipient)
            return cb(false, 'receipient does not exist')
        if (dao.availableBalance(creator) < fee)
            return cb(false, 'insufficient balance for proposal creation fee of '+(fee/100)+' DTUBE')

        cb(true)
    },
    execute: (tx, ts, cb) => {
        let fee = dao.proposalCreationFee(tx.data.requested)
        cache.insertOne('proposals', {
            _id: dao.nextID,
            type: dao.governanceTypes.fundRequest,
            creator: tx.sender,
            receiver: tx.data.receiver,
            requested: tx.data.requested,
            fee: fee,
            raised: 0,
            approvals: 0,
            disapprovals: 0,
            status: 0,
            json: tx.data.json,
            ts: ts,
            votingEnds: ts+(config.daoVotingPeriodSeconds*1000),
            fundingEnds: ts+(config.daoVotingPeriodSeconds*1000)+(config.fundRequestContribPeriodSeconds*1000),
            deadline: tx.data.deadline,
            leaderSnapshot: dao.leaderSnapshot()
        }, () => {
            dao.incrementID()
            // deduct fee
            cache.updateOne('accounts', {name: tx.sender}, {$inc: {balance: -fee}}, async () => {
                let sender = await cache.findOnePromise('accounts', {name: tx.sender})
                sender.balance += fee
                transaction.updateGrowInts(sender, ts, () =>
                    transaction.adjustNodeAppr(sender, -fee, () => cb(true)))
            })
        })
    }
}