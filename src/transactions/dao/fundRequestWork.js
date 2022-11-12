const dao = require('../../dao')

module.exports = {
    bsonValidate: true,
    fields: ['id','work'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid proposal id')

        // proposal json work details
        if (!validate.json(tx.data.work, config.jsonMaxBytes))
            return cb(false, 'invalid proposal json work details')

        let proposal = await cache.findOnePromise('proposals',{ _id: tx.data.id })
        if (!proposal)
            return cb(false, 'proposal does not exist')
        else if (proposal.creator !== tx.sender)
            return cb(false, 'only proposal creator can submit work')
        else if (proposal.type !== dao.governanceTypes.fundRequest)
            return cb(false, 'proposal type is not a fund request')
        let status = dao.getFundRequestStatus(proposal,ts)
        if (status === dao.fundRequestStatus.proposalExpired)
            return cb(false, 'proposal is expired')
        else if (status === dao.fundRequestStatus.reviewInProgress)
            return cb(false, 'work is already under review')
        else if (status === dao.fundRequestStatus.proposalComplete)
            return cb(false, 'proposal is already complete')
        else if (status !== dao.fundRequestStatus.fundingSuccess && status !== dao.fundRequestStatus.revisionRequired)
            return cb(false, 'proposal job is inactive')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        await cache.updateOnePromise('proposals',{ _id: tx.data.id },{
            $set: {
                work: tx.data.work,
                workTs: ts,
                reviews: [],
                reviewApprovals: 0,
                reviewDisapprovals: 0,
                reviewDeadline: ts+(config.fundRequestReviewPeriodSeconds*1000),
                status: dao.fundRequestStatus.reviewInProgress
            }
        })
        dao.updateProposalTrigger(tx.data.id,ts+(config.fundRequestReviewPeriodSeconds*1000))
        cb(true)
    }
}