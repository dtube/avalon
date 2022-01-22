module.exports = {
    fields: ['title', 'author', 'link', 'totalFund', 'initialFund', 'escrowAddress', 'json'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            logr.debug('invalid tx data.author')
            cb(false); return
        }
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        // handle arbitrary json input
        if (!validate.json(tx.data.json, config.jsonMaxBytes)) {
            cb(false, 'invalid tx data.json'); return
        }
         
        cb(true)
    },
    execute: (tx, ts, cb) => {
        var newProposal = {
            title: tx.data.title,
            author: tx.data.author,
            link: tx.data.link,
            totalFund: tx.data.totalFund,
            initialFund: tx.data.initialFund,
            raisedFund: tx.data.totalFund - tx.data.initialFund, 
            escrowAddress: tx.data.escrowAddress,
            json: tx.data.json,
            ts: ts
        }
        cache.insertOne('proposals', newProposal, function(){
            cb(true)
        })
    }
}