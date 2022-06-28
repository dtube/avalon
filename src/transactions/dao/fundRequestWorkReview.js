const dao = require('../../dao')

module.exports = {
    bsonValidate: true,
    fields: ['id','approve','memo'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid proposal id')

        if (typeof tx.data.approve !== 'boolean')
            return cb(false, 'tx.data.approve must be a boolean')

        if (!validate.string(tx.data.memo,config.memoMaxLength))
            return cb(false, 'memo must be a string with less than or equal to '+config.memoMaxLength+' characters')
        
        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        if (!proposal)
            return cb(false, 'proposal does not exist')
        if (!proposal.leaderSnapshot.includes(tx.sender))
            return cb(false, 'reviewer must be in the snapshot')
        let status = dao.getFundRequestStatus(proposal,ts)
        if (status !== dao.fundRequestStatus.reviewInProgress)
            return cb(false, 'proposal not in review process')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        let existingReviewIdx, existingApprove
        for (let r in proposal.reviews)
            if (proposal.reviews[r].reviewer === tx.sender) {
                existingReviewIdx = r
                existingApprove = proposal.reviews[r].approve
                break
            }
        let newReview = {
            reviewer: tx.sender,
            approve: tx.data.approve,
            memo: tx.data.memo
        }
        if (typeof existingReviewIdx === 'undefined')
            proposal.reviews.push(newReview)
        else
            proposal.reviews[existingReviewIdx] = newReview
        if (typeof existingApprove !== 'undefined')
            if (!existingApprove)
                proposal.reviewDisapprovals--
            else
                proposal.reviewApprovals--
        if (tx.data.approve)
            proposal.reviewApprovals++
        else
            proposal.reviewDisapprovals++
        let updateOp = {
            $set: {
                reviews: proposal.reviews,
                reviewApprovals: proposal.reviewApprovals,
                reviewDisapprovals: proposal.reviewDisapprovals
            },
            $unset: {}
        }
        let threshold = dao.getFundRequestReviewThreshold(proposal)
        if (updateOp.$set.reviewApprovals >= threshold) {
            await dao.disburseFundRequest(proposal.receiver,proposal.raised+proposal.fee,ts)
            updateOp.$set.paid = ts
            updateOp.$set.status = dao.fundRequestStatus.proposalComplete
            updateOp.$set.state = dao.proposalState.success
            dao.finalizeProposal(tx.data.id)
        } else if (updateOp.$set.reviewDisapprovals > proposal.leaderSnapshot.length - threshold) {
            let newDeadline = Math.max(proposal.deadline,ts+(config.fundRequestDeadlineExtSeconds*1000))
            updateOp.$set.status = dao.fundRequestStatus.revisionRequired
            updateOp.$set.deadline = newDeadline
            updateOp.$unset.reviewDeadline = ''
            dao.updateProposalTrigger(tx.data.id,newDeadline)
        }
        await cache.updateOnePromise('proposals',{ _id: tx.data.id },updateOp)
        cb(true)
    }
}