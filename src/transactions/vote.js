module.exports = {
    bsonValidate: true,
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
            cb(false, 'VP must be a non-zero integer'); return
        }
        if (!validate.string(tx.data.tag, config.tagMaxLength)) {
            cb(false, 'invalid tx data.tag'); return
        }
        let vpCheck = transaction.notEnoughVP(tx.data.vt, ts, legitUser)
        if (vpCheck.needs)
            return cb(false, 'not enough VP, attempting to spend '+tx.data.vt+' VP but only has '+vpCheck.has+' VP')

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
        let vote = {
            u: tx.sender,
            ts: ts,
            vt: tx.data.vt
        }
        if (tx.data.tag) vote.tag = tx.data.tag
        cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link},{$push: {
            votes: vote
        }}, function(){
            cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
                if (process.env.CONTENTS !== '1')
                    return eco.curation(tx.data.author, tx.data.link, function(distCurators, distMaster, burnCurator) {
                        if (!content.pa && !content.pp)
                            rankings.update(tx.data.author, tx.data.link, vote, distCurators)
                        cb(true, distCurators+distMaster, burnCurator)
                    })
                // update top tags
                let topTags = []
                for (let i = 0; i < content.votes.length; i++) {
                    let exists = false
                    for (let y = 0; y < topTags.length; y++)
                        if (topTags[y].tag === content.votes[i].tag) {
                            exists = true
                            topTags[y].vt += Math.abs(content.votes[i].vt)
                        }
                    if (!exists && content.votes[i].tag)
                        topTags.push({tag: content.votes[i].tag, vt: Math.abs(content.votes[i].vt)})
                }

                topTags = topTags.sort(function(a,b) {
                    return b.vt - a.vt
                })
                let tags = {}
                let tagKeys = 0
                let tagLoop = 0
                while (tagKeys < config.tagMaxPerContent && tagLoop < topTags.length) {
                    let t = topTags[tagLoop].tag.replace(/\$/g,'').replace(/\./g,'')
                    // tag must not be empty after filtering
                    if (t) {
                        tags[t] = topTags[tagLoop].vt
                        tagKeys++
                    }
                    tagLoop++
                }
                cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link},{$set: {
                    tags: tags
                }}, function(){
                    // monetary distribution (curation rewards)
                    eco.curation(tx.data.author, tx.data.link, function(distCurators, distMaster, burnCurator) {
                        if (!content.pa && !content.pp)
                            rankings.update(tx.data.author, tx.data.link, vote, distCurators)
                        cb(true, distCurators+distMaster, burnCurator)
                    })
                })
            })
        })
    }
}