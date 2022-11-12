const dao = require('../../dao')

module.exports = {
    bsonValidate: true,
    fields: ['title', 'description', 'url', 'requested', 'receiver'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        // total amount requested
        if (!validate.integer(tx.data.requested,false,false))
            return cb(false, 'invalid requested amount')

        // proposal fund beneficiary
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid proposal funding receiver')

        // proposal metadata
        if (!validate.string(tx.data.title, config.memoMaxLength))
            return cb(false, 'invalid proposal title string')

        if (!validate.string(tx.data.description, config.jsonMaxBytes))
            return cb(false, 'invalid proposal description string')

        if (!validate.string(tx.data.url, config.memoMaxLength))
            return cb(false, 'invalid proposal url string')

        let creator = await cache.findOnePromise('accounts',{ name: tx.sender })
        let receipient = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        let fee = dao.fundRequestCreationFee(tx.data.requested)
        if (!receipient)
            return cb(false, 'receipient does not exist')
        if (dao.availableBalance(creator,ts) < fee)
            return cb(false, 'insufficient balance for proposal creation fee of '+(fee/100)+' DTUBE')

        cb(true)
    },
    execute: (tx, ts, cb) => {
        let fee = dao.fundRequestCreationFee(tx.data.requested)
        let votingEnds = ts+(config.daoVotingPeriodSeconds*1000)
        let fundingEnds = votingEnds+(config.fundRequestContribPeriodSeconds*1000)
        let deadline = fundingEnds+(config.fundRequestDeadlineSeconds*1000)
        cache.insertOne('proposals', {
            _id: dao.nextID,
            type: dao.governanceTypes.fundRequest,
            title: tx.data.title,
            description: tx.data.description,
            url: tx.data.url,
            creator: tx.sender,
            receiver: tx.data.receiver,
            requested: tx.data.requested,
            fee: fee,
            raised: 0,
            approvals: 0,
            disapprovals: 0,
            status: 0,
            state: dao.proposalState.active,
            ts: ts,
            votingEnds: votingEnds,
            fundingEnds: fundingEnds,
            deadline: deadline,
            leaderSnapshot: dao.leaderSnapshot()
        }, () => {
            dao.incrementID(ts)
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