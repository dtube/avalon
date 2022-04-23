let dao = {
    proposalCreationFee: (requestedFund = 1) => {
        let baseFee = config.proposalCreationBaseFee
        let subseqAmounts = requestedFund-config.proposalCreationSubStart
        if (subseqAmounts <= 0)
            return baseFee
        let subseqFee = Math.ceil((subseqAmounts*config.proposalCreationSubFee)/config.proposalCreationSubMult)
        return baseFee+subseqFee
    }
}

module.exports = dao