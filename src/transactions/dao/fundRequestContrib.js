const dao = require('../../dao')

module.exports = {
    fields: ['id','amount'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid proposal id')

        if (!validate.integer(tx.data.amount,false,false))
            return cb(false, 'invalid contribution amount')

        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        let contributor = await cache.findOnePromise('accounts',{ name: tx.sender })
        if (!proposal)
            return cb(false, 'proposal does not exist')
        if (proposal.type !== dao.governanceTypes.fundRequest)
            return cb(false, 'proposal type is not a fund request')
        let status = dao.getFundRequestStatus(proposal,ts)
        if (status !== dao.fundRequestStatus.fundingActive)
            return cb(false, 'proposal not in funding stage')
        if (dao.availableBalance(contributor,ts) < tx.data.amount)
            return cb(false, 'insufficient balance')
        let notRaised = proposal.requested - proposal.raised
        if (tx.data.amount > notRaised)
            return cb(false, 'attempting to contribute '+(tx.data.amount/100)+' DTUBE but proposal only needs additional '+(notRaised/100)+' DTUBE in funding')
        if (config.masterDao && tx.sender === config.masterName && tx.data.amount > Math.floor(proposal.requested/2))
            return cb(false, 'master dao account can only fund up to half of requested amount')

        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        let updateOp = {
            $inc: { raised: tx.data.amount },
            $set: { contrib: {}}
        }
        if (!proposal.contrib)
            updateOp.$set.contrib[tx.sender] = tx.data.amount
        else {
            updateOp.$set.contrib = proposal.contrib
            if (!updateOp.$set.contrib[tx.sender])
                updateOp.$set.contrib[tx.sender] = tx.data.amount
            else
                updateOp.$set.contrib[tx.sender] += tx.data.amount
        }
        if (tx.data.amount + proposal.raised >= proposal.requested) {
            updateOp.$set.status = dao.fundRequestStatus.fundingSuccess
            dao.updateProposalTrigger(tx.data.id,proposal.deadline)
        }
        await cache.updateOnePromise('proposals',{ _id: tx.data.id },updateOp)
        await cache.updateOnePromise('accounts', {name: tx.sender}, {$inc: {balance: -tx.data.amount}})
        let sender = await cache.findOnePromise('accounts', {name: tx.sender})
        sender.balance += tx.data.amount
        await transaction.updateIntsAndNodeApprPromise(sender,ts,-tx.data.amount)
        cb(true)
    }
}