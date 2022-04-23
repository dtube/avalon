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
    leaderSnapshot: () => {
        let lastLeaders = {}
        for (let b = 1; b <= config.daoLeaderSnapshotBlocks; b++)
            lastLeaders[chain.recentBlocks[chain.recentBlocks.length-b].miner] = 1
        return Object.keys(lastLeaders)
    },
    loadID: async () => {
        let latestProposal = await db.collection('proposals').find({},{sort: {_id:-1},limit:1}).toArray()
        if (latestProposal && latestProposal.length > 0) {
            dao.lastID = latestProposal[0]._id
            dao.nextID = dao.lastID+1
        }
    },
    incrementID: () => dao.nextID++,
    resetID: () => dao.nextID = dao.lastID+1,
    nextBlock: () => dao.lastID = dao.nextID-1,
    nextID: 1,
    lastID: 0,
    governanceTypes: {
        fundRequest: 1,
        chainUpdate: 2
    }
}

module.exports = dao