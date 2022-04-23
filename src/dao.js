let dao = {
    proposalCreationFee: (requestedFund = 1) => {
        let baseFee = config.proposalCreationBaseFee
        let subseqAmounts = requestedFund-config.proposalCreationSubStart
        if (subseqAmounts <= 0)
            return baseFee
        let subseqFee = Math.ceil((subseqAmounts*config.proposalCreationSubFee)/config.proposalCreationSubMult)
        return baseFee+subseqFee
    },
    leaderSnapshot: () => {
        let lastLeaders = {}
        for (let b = 1; b <= config.daoLeaderSnapshotBlocks; b++)
            lastLeaders[chain.recentBlocks[chain.recentBlocks.length-b]] = 1
        return Object.keys(lastLeaders)
    }
}

module.exports = dao