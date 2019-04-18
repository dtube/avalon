var GrowInt = require('growint')

module.exports = {
    fields: ['link', 'pa', 'pp', 'json', 'vt', 'tag'],
    validate: (tx, ts, legitUser, cb) => {
        // permlink
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        // parent author
        if ((tx.data.pa || tx.data.pp) && !validate.string(tx.data.pa, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.pa'); return
        }
        // parent permlink
        if ((tx.data.pa || tx.data.pp) && !validate.string(tx.data.pp, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.pp'); return
        }
        // handle arbitrary json input
        if (!validate.json(tx.data.json, config.jsonMaxBytes)) {
            cb(false, 'invalid tx data.json'); return
        }
        // users need to vote the content at the same time with vt and tag field
        if (!validate.integer(tx.data.vt, false, true)) {
            cb(false, 'invalid tx data.vt'); return
        }
        if (!validate.string(tx.data.tag, config.tagMaxLength)) {
            cb(false, 'invalid tx data.tag'); return
        }
        // checking if they have enough VTs
        var vtBeforeComment = new GrowInt(legitUser.vt, {growth:legitUser.balance/(config.vtGrowth)}).grow(ts)
        if (vtBeforeComment.v < Math.abs(tx.data.vt)) {
            cb(false, 'invalid tx not enough vt'); return
        }

        if (tx.data.pa && tx.data.pp) 
            // its a comment of another comment
            cache.findOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, function(err, content) {
                if (!content) {
                    cb(false, 'invalid tx parent comment does not exist'); return
                }
                cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                    if (content) {
                        // user is editing an existing comment
                        if (content.pa !== tx.data.pa || content.pp !== tx.data.pp) {
                            cb(false, 'invalid tx parent comment cannot be edited'); return
                        }
                    } else 
                        // it is a new comment
                        cb(true)
                    
                })
            })
        else 
            cb(true)
    },
    execute: (tx, ts, cb) => {

    }
}