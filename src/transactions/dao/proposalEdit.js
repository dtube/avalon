const dao = require("../../dao")

module.exports = {
    bsonValidate: true,
    fields: ['id','title','description','url'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!config.daoEnabled)
            return cb(false, 'dao is not enabled')

        if (!validate.integer(tx.data.id,false,false))
            return cb(false, 'invalid proposal id')

        if (!validate.string(tx.data.title, config.memoMaxLength))
            return cb(false, 'invalid proposal title string')

        if (!validate.string(tx.data.description, config.jsonMaxBytes))
            return cb(false, 'invalid proposal description string')

        if (!validate.string(tx.data.url, config.memoMaxLength))
            return cb(false, 'invalid proposal url string')
        
        let proposal = await cache.findOnePromise('proposals', { _id: tx.data.id })
        if (!proposal)
            return cb(false, 'proposal does not exist')
        if (proposal.creator !== tx.sender)
            return cb(false, 'only proposal creator can edit proposal metadata')
        if (proposal.type === dao.governanceTypes.fundRequest) {
            let status = dao.getFundRequestStatus(proposal,ts)
            if (status !== dao.fundRequestStatus.votingActive &&
                status !== dao.fundRequestStatus.fundingActive)
                    return cb(false, 'cannot edit inactive proposals or fund requests past its funding stage')
        } else if (proposal.type === dao.governanceTypes.chainUpdate) {
            let status = dao.getChainUpdateStatus(proposal,ts)
            if (status !== dao.chainUpdateStatus.votingActive)
                return cb(false, 'cannot edit chain update proposals past its voting period')
        }
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let updateOp = {
            $set: {}
        }
        if (tx.data.title)
            updateOp.$set.title = tx.data.title
        if (tx.data.description)
            updateOp.$set.description = tx.data.description
        if (tx.data.url)
            updateOp.$set.url = tx.data.url
        await cache.updateOnePromise('proposals', { _id: tx.data.id }, updateOp)
        cb(true)
    }
}