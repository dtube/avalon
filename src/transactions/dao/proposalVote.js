const dao = require("../../dao")

module.exports = {
    fields: ['id','amount'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid proposal id')

        if (!validate.integer(tx.data.amount,false,true))
            return cb(false, 'invalid voting weight amount')

        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        let voter = await cache.findOnePromise('accounts',{ name: tx.sender })
        if (!proposal)
            return cb(false, 'proposal does not exist')
        if (proposal.votingEnds < ts)
            return cb(false, 'proposal voting period already ended')
        if (voter.proposalVotes)
            for (let v in voter.proposalVotes)
                if (voter.proposalVotes[v].id === tx.data.id)
                    return cb(false, 'already voted on proposal')
        
        // Available voting weight check
        let availWeight = voter.balance
        if (proposal.leaderSnapshot.includes(tx.sender))
            availWeight += config.daoVotingLeaderBonus
        if (Math.abs(tx.data.amount) > availWeight)
            return cb(false, 'insufficient voting weight')

        cb(true)
    },
    execute: async (tx, ts, cb) => {
        // increment proposal vote weights
        let proposalUpdate = { $inc: {} }
        if (tx.data.amount < 0)
            proposalUpdate.$inc.disapprovals = Math.abs(tx.data.amount)
        else if (tx.data.amount > 0)
            proposalUpdate.$inc.approvals = tx.data.amount
        await cache.updateOnePromise('proposals',{ _id: tx.data.id }, proposalUpdate)

        // update voter info
        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        let voter = await cache.findOnePromise('accounts', { name: tx.sender })
        let incVoteLock = Math.abs(tx.data.amount) - (voter.voteLock || 0)
        let bonusApplied = 0
        if (proposal.leaderSnapshot.includes(tx.sender)) {
            incVoteLock -= config.daoVotingLeaderBonus
            bonusApplied = config.daoVotingLeaderBonus
        }
        if (incVoteLock < 0)
            incVoteLock = 0
        await cache.updateOnePromise('accounts', { name: tx.sender }, {
            $inc: {
                voteLock: incVoteLock
            },
            $push: {
                proposalVotes: {
                    id: tx.data.id,
                    amount: Math.abs(tx.data.amount),
                    bonus: bonusApplied,
                    veto: tx.data.amount < 0,
                    end: proposal.votingEnds
                }
            }
        })
        dao.pushVote({
            _id: tx.sender+'/'+tx.data.id,
            proposal_id: tx.data.id,
            voter: tx.sender,
            amount: Math.abs(tx.data.amount),
            bonus: bonusApplied,
            veto: tx.data.amount < 0,
            end: proposal.votingEnds
        })
        cb(true)
    }
}