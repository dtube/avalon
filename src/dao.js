let dao = {
    availableBalance: (account,ts) => {
        if (!account.voteLock)
            return account.balance
        let newLock = 0
        for (let v in account.proposalVotes)
            if (account.proposalVotes[v].end > ts && account.proposalVotes[v].amount - account.proposalVotes[v].bonus > newLock)
                newLock = account.proposalVotes[v].amount - account.proposalVotes[v].bonus
        return account.balance - newLock
    },
    proposalCreationFee: (requestedFund = 1) => {
        let baseFee = config.fundRequestBaseFee
        let subseqAmounts = requestedFund-config.fundRequestSubStart
        if (subseqAmounts <= 0)
            return baseFee
        let subseqFee = Math.ceil((subseqAmounts*config.fundRequestSubFee)/config.fundRequestSubMult)
        return baseFee+subseqFee
    },
    getFundRequestStatus: (proposal,ts) => {
        if (proposal.votingEnds > ts)
            return dao.fundRequestStatus.votingActive
        else if (proposal.votingEnds <= ts && (proposal.approvals < config.daoVotingThreshold || proposal.approvals < proposal.disapprovals))
            return dao.fundRequestStatus.votingRejected
        else if (proposal.raised !== proposal.requested)
            if (proposal.fundingEnds > ts)
                return dao.fundRequestStatus.fundingActive
            else
                return dao.fundRequestStatus.fundingFailed
        else if (!proposal.work)
            if (proposal.deadline < ts)
                return dao.fundRequestStatus.proposalExpired
            else
                return dao.fundRequestStatus.fundingSuccess
        else if (!proposal.paid && proposal.workTs+(config.fundRequestReviewPeriodSeconds*1000) > ts)
            return dao.fundRequestStatus.reviewInProgress
        else
            return dao.fundRequestStatus.proposalComplete
    },
    refundContributors: async (proposal,ts) => {
        if (!proposal.contrib)
            return
        for (let c in proposal.contrib) {
            let refundee = cache.findOnePromise('accounts',{ name: c })
            await cache.updateOnePromise('accounts',{ name: c },{ $inc: proposal.contrib[c] })
            await transaction.updateIntsAndNodeApprPromise(refundee,ts,proposal.contrib[c])
        }
    },
    disburseFundRequest: async (receiver,amount,ts) => {
        let beneficiary = await cache.findOnePromise('accounts',{ name: receiver })
        await cache.updateOnePromise('accounts',{ name: receiver },{ $inc: { balance: amount }})
        await transaction.updateIntsAndNodeApprPromise(beneficiary,ts,amount)
    },
    leaderSnapshot: () => {
        let lastLeaders = {}
        for (let b = 1; b <= config.daoLeaderSnapshotBlocks; b++)
            if (chain.recentBlocks.length-b >= 0)
                lastLeaders[chain.recentBlocks[chain.recentBlocks.length-b].miner] = 1
        return Object.keys(lastLeaders)
    },
    runTriggers: async (ts) => {
        let feeBurn = 0
        let currentTriggers = {}
        for (let p in dao.activeProposalIDs)
            if (dao.activeProposalIDs[p] <= ts)
                currentTriggers[p] = dao.activeProposalIDs[p]
        for (let p in currentTriggers) {
            let proposal = await cache.findOnePromise('proposals',{ _id: p })
            if (proposal && proposal.type === dao.governanceTypes.fundRequest) {
                let newStatus = dao.getFundRequestStatus(proposal,ts)
                let updateOp = { $set: { status: newStatus }}
                logr.trace('DAO trigger',newStatus,proposal)
                if (newStatus === dao.fundRequestStatus.votingRejected) {
                    feeBurn += proposal.fee
                    dao.finalizeProposal(p)
                } else if (newStatus === dao.fundRequestStatus.fundingFailed || newStatus === dao.fundRequestStatus.proposalExpired) {
                    feeBurn += proposal.fee
                    await dao.refundContributors(proposal,ts)
                    dao.finalizeProposal(p)
                } else if (newStatus === dao.fundRequestStatus.fundingActive)
                    dao.updateProposalTrigger(p,proposal.fundingEnds)
                else if (newStatus === dao.fundRequestStatus.fundingSuccess)
                    dao.updateProposalTrigger(p,proposal.deadline)
                else if (newStatus === dao.fundRequestStatus.proposalComplete) {
                    logr.trace('Beneficiary balance before',(await cache.findOnePromise('accounts',{name:proposal.receiver})).balance)
                    await dao.disburseFundRequest(proposal.receiver,proposal.raised+proposal.fee,ts)
                    logr.trace('Beneficiary balance after',(await cache.findOnePromise('accounts',{name:proposal.receiver})).balance)
                    updateOp.$set.paid = ts
                    dao.finalizeProposal(p)
                }

                await cache.updateOnePromise('proposals',{ _id: p },updateOp)
            }
        }
        return feeBurn
    },
    updateProposalTrigger: (id,newTs) => {
        if (!dao.activeProposalTriggerLast[id])
            dao.activeProposalTriggerLast[id] = dao.activeProposalIDs[id]
        dao.activeProposalIDs[id] = newTs
    },
    finalizeProposal: (id) => {
        dao.activeProposalFinalizes[id] = dao.activeProposalIDs[id]
        delete dao.activeProposalIDs[id]
    },
    loadActiveFundRequests: async () => {
        let activeRequests = await db.collection('proposals').find({$and: [
            {type:1},
            {$or: [
                {status: 0},
                {status: 2},
                {status: 3},
                {status: 5},
            ]}
        ]}).toArray()
        for (let i in activeRequests) {
            cache.proposals[activeRequests[i]._id] = activeRequests[i]
            switch (activeRequests[i].status) {
                case 0:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].votingEnds
                    break
                case 2:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].fundingEnds
                    break
                case 3:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].deadline
                    break
                case 5:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].workTs+(config.fundRequestReviewPeriodSeconds*1000)
                    break
            }
        }
    },
    loadID: async () => {
        let latestProposal = await db.collection('proposals').find({},{sort: {_id:-1},limit:1}).toArray()
        if (latestProposal && latestProposal.length > 0) {
            dao.lastID = latestProposal[0]._id
            dao.nextID = dao.lastID+1
        }
    },
    incrementID: () => dao.nextID++,
    resetID: () => {
        // resrt last id
        dao.nextID = dao.lastID+1

        // reset proposal triggers
        for (let p in dao.activeProposalTriggerLast)
            dao.activeProposalIDs[p] = dao.activeProposalTriggerLast[p]
        dao.activeProposalTriggerLast = {}

        // reset proposal finalizes
        for (let p in dao.activeProposalFinalizes)
            dao.activeProposalIDs[p] = dao.activeProposalFinalizes[p]
        dao.activeProposalFinalizes = {}
    },
    nextBlock: async (ts) => {
        // update ids for new proposals
        if (dao.nextID - dao.lastID >= 2)
            for (let i = dao.lastID+1; i < dao.nextID; i++)
                dao.activeProposalIDs[i] = ts+(config.daoVotingPeriodSeconds*1000)
        dao.lastID = dao.nextID-1

        // clear old triggers and finalizes
        dao.activeProposalTriggerLast = {}
        dao.activeProposalFinalizes = {}
    },
    nextID: 1,
    lastID: 0,
    activeProposalIDs: {},
    activeProposalTriggerLast: {},
    activeProposalFinalizes: {},
    governanceTypes: {
        fundRequest: 1,
        chainUpdate: 2
    },
    fundRequestStatus: {
        votingActive: 0,
        votingRejected: 1,
        fundingActive: 2,
        fundingSuccess: 3,
        fundingFailed: 4,
        reviewInProgress: 5,
        proposalComplete: 6,
        proposalExpired: 7
    }
}

module.exports = dao

/*
Fund request status transitions:

votingActive to votingRejected -> trigger
votingActive to fundingActice -> trigger
fundingActive to fundingSuccess -> tx (proposal.raised === proposal.requested)
functingActive to fundingFailed -> trigger
fundingSuccess to reviewInProgress -> tx (submit work)
fundingSuccess to proposalExpired -> trigger
reviewInProgress to proposalComplete -> trigger or tx
*/