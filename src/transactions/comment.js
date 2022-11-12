module.exports = {
    bsonValidate: true,
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
            cb(false, 'VP must be a non-zero integer'); return
        }
        if (!validate.string(tx.data.tag, config.tagMaxLength)) {
            cb(false, 'invalid tx data.tag'); return
        }
        if (tx.data.tag.indexOf('.') > -1 || tx.data.tag.indexOf('$') > -1) {
            cb(false, 'tag must not contain \'.\' or \'$\' characters'); return
        }
        let vpCheck = transaction.notEnoughVP(tx.data.vt, ts, legitUser)
        if (vpCheck.needs)
            return cb(false, 'not enough VP, attempting to spend '+tx.data.vt+' VP but only has '+vpCheck.has+' VP')

        if (tx.data.pa && tx.data.pp) 
            // its a comment of another comment
            cache.findOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, function(err, content) {
                if (!content) {
                    cb(false, 'invalid tx parent comment does not exist'); return
                }
                cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                    if (content)
                        // user is editing an existing comment
                        if (content.pa !== tx.data.pa || content.pp !== tx.data.pp)
                            return cb(false, 'invalid tx parent comment cannot be edited')
                        else
                            cb(true)
                    else
                        // it is a new comment
                        cb(true)
                })
            })
        else 
            cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (err) throw err
            if (content && process.env.CONTENTS === '1')
                // existing content being edited
                cache.updateOne('contents', {_id: tx.sender+'/'+tx.data.link}, {
                    $set: {json: tx.data.json}
                }, function(){
                    content.json = tx.data.json
                    if (!tx.data.pa && !tx.data.pp)
                        rankings.new(content)
                    cb(true)
                })
            else if (content)
                // existing content being edited but node running without CONTENT module
                cb(true)
            else {
                // new content
                let vote = {
                    u: tx.sender,
                    ts: ts,
                    vt: tx.data.vt
                }
                
                let newContent = {
                    _id: tx.sender+'/'+tx.data.link,
                    author: tx.sender,
                    link: tx.data.link,
                    pa: tx.data.pa,
                    pp: tx.data.pp,
                    json: process.env.CONTENTS === '1' ? tx.data.json : {},
                    child: [],
                    votes: [vote],
                    ts: ts
                }
                if (tx.data.tag && process.env.CONTENTS === '1')  {
                    vote.tag = tx.data.tag
                    newContent.tags = {}
                    newContent.tags[tx.data.tag] = Math.abs(vote.vt)
                }
                cache.insertOne('contents', newContent, function(){
                    // monetary distribution (curation rewards)
                    eco.curation(tx.sender, tx.data.link, function(distCurators, distMaster) {
                        if (tx.data.pa && tx.data.pp && process.env.CONTENTS === '1') 
                            cache.updateOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, { $push: {
                                child: [tx.sender, tx.data.link]
                            }}, function() {
                                cb(true, distCurators+distMaster, tx.data.burn)
                            })
                        else {
                            // and report how much was burnt
                            cb(true, distCurators+distMaster, tx.data.burn)
                            if (!tx.data.pa || !tx.data.pp) rankings.new(newContent)
                        }
                    })                    
                })
            }
        })
    }
}