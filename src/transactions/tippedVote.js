module.exports = {
    bsonValidate: true,
    fields: ['link', 'author', 'vt', 'tag', 'tip'],
    validate: (tx, ts, legitUser, cb) => {
        // Check if author vote exists and whether author has claimed the reward
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid tx data.author')
        
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid tx data.link')
        
        if (!validate.integer(tx.data.vt, false, true))
            return cb(false, 'VP must be a non-zero integer')
        
        if (!validate.string(tx.data.tag, config.tagMaxLength))
            return cb(false, 'invalid tx data.tag')
        
        let vpCheck = transaction.notEnoughVP(tx.data.vt, ts, legitUser)
        if (vpCheck.needs)
            return cb(false, 'not enough VP, attempting to spend '+tx.data.vt+' VP but only has '+vpCheck.has+' VP')

        // tip should be between 1 and 10^config.tippedVotePrecision
        if (!validate.integer(tx.data.tip,false,false,Math.pow(10,config.tippedVotePrecision),1))
            return cb(false, 'invalid author tip value')
        
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, (err, content) => {
            if (err) throw err
            if (!content) return cb(false, 'cannot vote and tip non-existent content')
            if (content.votes.length === 0) return cb(false, 'no votes in this content to tip author with')

            // author should be voted and not claimed reward
            let authorVote = false
            let authorVoteClaimed = false
            for (let v = 0; v < content.votes.length; v++)
                if (content.votes[v].u === tx.data.author) {
                    authorVote = true
                    if (content.votes[v].claimed)
                        authorVoteClaimed = true
                    break
                }

            // probably content imported from genesis
            if (!authorVote) return cb(false, 'author vote does not exist')

            // can only tip author that have not claimed reward
            if (authorVoteClaimed) return cb(false, 'author has already claimed reward')

            // the remaining validations are the same as votes without author tip
            if (!config.allowRevotes) 
                for (let i = 0; i < content.votes.length; i++) 
                    if (tx.sender === content.votes[i].u) {
                        cb(false, 'invalid tx user has already voted'); return
                    }
            cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        // same as vote but with (tx.data.tip / 10^config.tippedVotePrecision) of rewards tipped to author (first vote)
        let vote = {
            u: tx.sender,
            ts: ts,
            vt: tx.data.vt,
            tip: tx.data.tip/Math.pow(10,config.tippedVotePrecision)
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