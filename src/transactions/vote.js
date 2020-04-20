module.exports = {
    fields: ['link', 'author', 'vt', 'tag'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            logr.debug('invalid tx data.author')
            cb(false); return
        }
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        if (!validate.integer(tx.data.vt, false, true)) {
            cb(false, 'invalid tx data.vt'); return
        }
        if (!validate.string(tx.data.tag, config.tagMaxLength)) {
            cb(false, 'invalid tx data.tag'); return
        }
        if (!transaction.hasEnoughVT(tx.data.vt, ts, legitUser)) {
            cb(false, 'invalid tx not enough vt'); return
        }
        // checking if content exists
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
            if (!content) {
                cb(false, 'invalid tx non-existing content'); return
            }
            if (!config.allowRevotes) 
                for (let i = 0; i < content.votes.length; i++) 
                    if (tx.sender === content.votes[i].u) {
                        cb(false, 'invalid tx user has already voted'); return
                    }
                
            
            cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        var vote = {
            u: tx.sender,
            ts: ts,
            vt: tx.data.vt
        }
        if (tx.data.tag) vote.tag = tx.data.tag
        cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link},{$push: {
            votes: vote
        }}, function(){
            cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
                // update top tags
                var topTags = []
                for (let i = 0; i < content.votes.length; i++) {
                    var exists = false
                    for (let y = 0; y < topTags.length; y++)
                        if (topTags[y].tag === content.votes[i].tag) {
                            exists = true
                            topTags[y].vt += content.votes[i].vt
                        }
                    if (!exists && content.votes[i].tag)
                        topTags.push({tag: content.votes[i].tag, vt: content.votes[i].vt})
                }

                topTags = topTags.sort(function(a,b) {
                    return b.vt - a.vt
                })
                topTags = topTags.slice(0, config.tagMaxPerContent)
                var tags = {}
                for (let i = 0; i < topTags.length; i++)
                    tags[topTags[i].tag] = topTags[i].vt
                cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link},{$set: {
                    tags: tags
                }}, function(){
                    // monetary distribution (curation rewards)
                    eco.curation(tx.data.author, tx.data.link, function(distCurators, distMaster) {
                        if (!content.pa && !content.pp)
                            rankings.update(tx.data.author, tx.data.link, vote, distCurators)
                        cb(true, distCurators+distMaster)
                    })
                })
            })
        })
    }
}