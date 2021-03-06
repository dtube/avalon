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
                if (process.env.CONTENTS != '1') {
                    return eco.curation(tx.data.author, tx.data.link, function(distCurators, distMaster, burnCurator) {
                        if (!content.pa && !content.pp)
                            rankings.update(tx.data.author, tx.data.link, vote, distCurators)
                        cb(true, distCurators+distMaster, burnCurator)
                    })
                }
                // update top tags
                var topTags = []
                for (let i = 0; i < content.votes.length; i++) {
                    var newTags = {}
                    for (let y = 0; y < topTags.length; y++) {
                        contentTags = []
                        tmpTags = content.votes[i].tag
                        if (tmpTags.length > config.tagMaxLength)
                            tmpTags = tmpTags.substring(0, config.tagMaxLength)
                        tmpTags = content.votes[i].tag.trim().split(",")
                        for (let j = 0; j < tmpTags.length; j++) {
                            contentTags.push(tmpTags[j].trim())
                        }

                        // idea is to distribute the vt equally to all comma separated tags, the extra is given to the first tag
                        // process for each comma separated tags
                        nTag = contentTags.length
                        totalTagVt = content.votes[i].vt
                        for (let j = 0; j < nTag; j++) {
                            curTag = contentTags[j]
                            curTagVt = (totalTagVt / nTag) + (totalTagVt % nTag) // the modulo part will be zero for j > 0 because of the next if block, see example below

                            if (j == 0) {
                                totalTagVt = totalTagVt - (totalTagVt % nTag)   // removing the extra modulo part for all other tags except the first one
                            }

                            if (topTags[y].tag === curTag) {
                                topTags[y].vt += Math.abs(curTagVt)
                                newTags[curTag] = null // tag already exists, so nullifying pre-pushed tag
                            } else {
                                newTags[curTag] = {tag: curTag, vt: Math.abs(curTagVt)}
                            }
                        }
                         /*
                        Example:
                        content.votes[i].tag = "hike, hiking, hiker"
                        totalTagVt = 313
                        nt = 3

                        topTags[0] = {tag: "hike", vt: 313/3 + 313%3 = 104 + 1 = 105} // hike

                        totalTagVt = 313 - (313%3) = 313 - 1 = 312

                        topTags[1] = {tag: "hiking", vt: 312/3 + 312%3 = 104} // hiking

                        topTags[2] = {tag: "hiker", vt: 312/3 + 312%3 = 104} // hiker

                        105 + 104 + 104 = 313 total
                        */
                    }

                    for (let [tagKey, tagVal] of newTags) {
                        if (!tagVal && tagVal.tag) {// if tagKey not null, then exists false, then push
                            topTags.push(tagVal)
                        }
                    }
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