module.exports = {
    fields: ['id', 'totalFund', 'initialFund', 'raisedFund', 'escrowAddress', 'json'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.id, config.accountMaxLength, config.accountMinLengthconfig.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid proposal id')

        // proposal json metadata
        if (!validate.json(tx.data.json, config.jsonMaxBytes))
            return cb(false, 'invalid tx data.json')
         
        cb(true)
    },
    execute: (tx, ts, cb) => {
        let newProposal = {
            _id: tx.sender+'/'+tx.data.id,
            creator: tx.sender,
            totalFund: tx.data.totalFund,
            initialFund: tx.data.initialFund,
            raisedFund: tx.data.initialFund,
            escrowAddress: tx.data.escrowAddress,
            json: tx.data.json,
            ts: ts
        }
        cache.insertOne('proposals', newProposal, function(){
            cb(true)
        })
    }
}