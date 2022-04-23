const dao = require('../dao')

module.exports = {
    fields: ['id', 'requested', 'receiver', 'json'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'proposals system is not enabled')

        if (!validate.string(tx.data.id, config.accountMaxLength, config.accountMinLengthconfig.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid proposal id')

        // total amount requested
        if (!validate.integer(tx.data.requested,false,false))
            return cb(false, 'invalid requested amount')

        // proposal fund beneficiary
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid proposal funding receiver')

        // proposal json metadata
        if (!validate.json(tx.data.json, config.jsonMaxBytes))
            return cb(false, 'invalid proposal json metadata')

        let proposal = await cache.findOnePromise('proposals',{_id: tx.sender+'/'+tx.data.id})
        let creator = await cache.findOnePromise('accounts',{ name: tx.sender })
        let receipient = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        let fee = dao.proposalCreationFee(tx.data.requested)
        if (proposal)
            return cb(false, 'proposal id already exists')
        if (!receipient)
            return cb(false, 'receipient does not exist')
        if (creator.balance < fee)
            return cb(false, 'insufficient balance for proposal creation fee of '+(fee/100)+' DTUBE')

        cb(true)
    },
    execute: (tx, ts, cb) => {
        let fee = dao.proposalCreationFee(tx.data.requested)
        cache.insertOne('proposals', {
            _id: tx.sender+'/'+tx.data.id,
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
            votingEnds: ts+(config.proposalVotingPeriodSeconds*1000),
            fundingEnds: ts+(config.proposalVotingPeriodSeconds*1000)+(config.proposalFundingPeriodSeconds*1000),
            leaderSnapshot: dao.leaderSnapshot()
        }, () => {
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