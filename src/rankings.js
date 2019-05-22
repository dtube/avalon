var decay = require('decay')
const hotHalfTime = 45000
const trendingHalfTime = 201600
const expireFactor = 5000

var rankings = {
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
        rankings.contents = {
            hot: [],
            trending: []
        }
        // load from db and generate
        rankings.generate()
        // then rescore them once every minute (score decays through time)
        setInterval(function(){rankings.rescore()}, 60000)
    },
    generate: function() {
        for (const key in rankings.types) {
            var minTs = new Date().getTime() - rankings.types[key].halfLife*expireFactor
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
        for (const key in rankings.types) {
            var alreadyAdded = false
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
            content.dist = 0
            if (content.votes[0].vt > 0)
                content.ups += Math.abs(content.votes[0].vt)
            if (content.votes[0].vt < 0)
                content.downs += Math.abs(content.votes[0].vt)
            rankings.contents[key].push(content)
        }
    },
    update: function(author, link, vote, dist) {
        for (const key in rankings.types) {
            newRankings = []
            for (let i = 0; i < rankings.contents[key].length; i++) {
                var ts = rankings.contents[key][i].ts
                if (rankings.contents[key][i].author === author && rankings.contents[key][i].link === link) {
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
                        
                    rankings.contents[key][i].score = rankings.types[key].score(rankings.contents[key][i].ups, rankings.contents[key][i].downs, new Date(ts))
                }
                if (ts > new Date().getTime() - rankings.types[key].halfTime*expireFactor)
                    newRankings.push(rankings.contents[key][i])
            }
            rankings.contents[key] = newRankings.sort(function(a,b) {
                return b.score - a.score
            })
        }
    },
    rescore: function() {
        for (const key in rankings.types) {
            for (let i = 0; i < rankings.contents[key].length; i++)
                rankings.contents[key][i].score = rankings.types[key].score(rankings.contents[key][i].ups, rankings.contents[key][i].downs, new Date(rankings.contents[key][i].ts))
            rankings.contents[key] = rankings.contents[key].sort(function(a,b) {
                return b.score - a.score
            })
        }
    }
}

module.exports = rankings