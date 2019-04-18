var TransactionType = require('../transactions').Types

module.exports = {
    fields: ['link', 'pa', 'pp', 'json', 'vt', 'tag', 'burn'],
    validate: (tx, ts, legitUser, cb) => {
        // first verify that the user isn't editing an existing content
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (err) throw err
            if (content) {
                cb(false, 'cannot edit and promote'); return
            }
            // then verify that the same comment without promotion would be ok
            var comment = {
                type: TransactionType.COMMENT,
                data: Object.assign({}, tx.data)
            }
            delete comment.data.burn
            transaction.isValidTxData(comment, ts, legitUser, function(isValid, error) {
                if (isValid) {
                    // and checking if user has enough coins to burn
                    if (!tx.data.burn || typeof tx.data.burn !== 'number' || tx.data.burn < 1 || tx.data.burn > Number.MAX_SAFE_INTEGER) {
                        cb(false, 'invalid tx data.burn'); return
                    }
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (err) throw err
                        if (account.balance < tx.data.burn) {
                            cb(false, 'invalid tx not enough balance to burn'); return
                        }
                        cb(true)
                    })
                } else
                    cb(isValid, error)
            })
        })
    },
    execute: (tx, ts, cb) => {

    }
}