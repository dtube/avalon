const decay = require('decay')
const cloneDeep = require('clone-deep')
const hotHalfTime = 43200 // 12 hours
const trendingHalfTime = 302400 // 3.5 days
const expireFactor = 5000 // disappears after 5 half times
const isEnabled = process.env.RANKINGS || false

let rankings = {
    expireFactor: expireFactor,
    types: {
        hot: {
            halfLife: hotHalfTime,
            score: decay.redditHot(hotHalfTime)
        },
        trending: {
            halfLife: trendingHalfTime,
            score: decay.redditHot(trendingHalfTime)
        }
    },
    init: function() {
        if (!isEnabled || chain.getLatestBlock()._id < chain.restoredBlocks) return
        rankings.contents = {
            hot: [],
            trending: []
        }
        // load from db and generate
        rankings.generate()
        // then rescore them once every minute (score decays through time)
        setInterval(function(){rankings.rescore()}, 60000)
        logr.trace('Rankings initialized')
    },
    generate: function() {
        if (!isEnabled || chain.getLatestBlock()._id < chain.restoredBlocks) return
        for (const key in rankings.types) {
            let minTs = new Date().getTime() - rankings.types[key].halfLife*expireFactor
            db.collection('contents').find({pa: null, ts: {'$gt': minTs}}, {sort: {ts: -1}}).toArray(function(err, contents) {
                for (let i = 0; i < contents.length; i++) {
                    contents[i].score = 0
                    contents[i].ups = 0
                    contents[i].downs = 0
                    if (!contents[i].dist) contents[i].dist = 0
                    
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].vt > 0)
                            contents[i].ups += Math.abs(contents[i].votes[y].vt)
                        if (contents[i].votes[y].vt < 0)
                            contents[i].downs += Math.abs(contents[i].votes[y].vt)
                        
                    }
                    contents[i].score = rankings.types[key].score(contents[i].ups, contents[i].downs, new Date(contents[i].ts))
                }
                contents = contents.sort(function(a,b) {
                    return b.score - a.score
                })
                rankings.contents[key] = contents
            })
        }
        
    },
    new: function(content) {
        if (!isEnabled || chain.getLatestBlock()._id < chain.restoredBlocks) return
        content = cloneDeep(content)
        for (const key in rankings.types) {
            let alreadyAdded = false
            for (let i = 0; i < rankings.contents[key].length; i++) 
                if (content.author === rankings.contents[key][i].author && content.link === rankings.contents[key][i].link) {
                    alreadyAdded = true
                    rankings.contents[key][i].json = content.json
                    break
                }
            
            if (alreadyAdded) return
    
            content._id = content.author+'/'+content.link
            content.score = 0
            content.ups = 0
            content.downs = 0
            content.dist = content.dist ? content.dist : 0
            if (content.votes[0] && content.votes[0].vt > 0)
                content.ups += Math.abs(content.votes[0].vt)
            if (content.votes[0] && content.votes[0].vt < 0)
                content.downs += Math.abs(content.votes[0].vt)
            rankings.contents[key].push(JSON.parse(JSON.stringify(content)))
        }
    },
    update: function(author, link, vote, dist) {
        if (!isEnabled || chain.getLatestBlock()._id < chain.restoredBlocks) return
        for (const key in rankings.types)
            for (let i = 0; i < rankings.contents[key].length; i++)
                if (rankings.contents[key][i].author === author && rankings.contents[key][i].link === link) {
                    let ts = rankings.contents[key][i].ts
                    if (ts < new Date().getTime() - rankings.types[key].halfTime*expireFactor)
                        return
                    
                    for (let y = 0; y < rankings.contents[key][i].votes.length; y++)
                        if (rankings.contents[key][i].votes[y].u === vote.u)
                            return
                    
                    if (vote.vt > 0)
                        rankings.contents[key][i].ups += Math.abs(vote.vt)
                    if (vote.vt < 0)
                        rankings.contents[key][i].downs += Math.abs(vote.vt)
                    if (dist)
                        rankings.contents[key][i].dist += dist
                    if (!rankings.contents[key][i].votes)
                        rankings.contents[key][i].votes = [vote]
                    else
                        rankings.contents[key][i].votes.push(vote)
                    
                    break
                }
    },
    rescore: function() {
        if (!isEnabled || chain.getLatestBlock()._id < chain.restoredBlocks) return
        logr.trace('Regenerating rankings')
        for (const key in rankings.types) {
            for (let i = 0; i < rankings.contents[key].length; i++)
                rankings.contents[key][i].score = rankings.types[key].score(rankings.contents[key][i].ups, rankings.contents[key][i].downs, new Date(rankings.contents[key][i].ts))
            rankings.contents[key] = rankings.contents[key].sort(function(a,b) {
                return b.score - a.score
            })
        }
        logr.trace('Finished regenerating rankings')
    }
}

module.exports = rankings