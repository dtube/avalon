module.exports = {
    init: (app) => {
        /**
         * @api {get} /votes/all/:voter/:lastTs All Votes
         * @apiName votesAll
         * @apiGroup Vote History
         * 
         * @apiParam {String} voter Username of voter
         * @apiParam {Integer} lastTs Last timestamp of votes to be queried
         * 
         * @apiSuccess {Object[]} votes Complete list of votes made by voter
         * @apiSuccess {String} votes.author Author of vote
         * @apiSuccess {String} votes.link Permlink of vote
         * @apiSuccess {Double} votes.claimable Amount claimable from vote
         * @apiSuccess {Double} [votes.claimed] Timestamp of when the curation rewards from the vote was claimed
         * @apiSuccess {Integer} votes.vt VP spent on vote
         * @apiSuccess {Integer} votes.ts Timestamp of when the vote was casted
         * @apiSuccess {Integer} votes.contentTs Timestamp of the content being voted on
         */
        app.get('/votes/all/:voter/:lastTs', (req, res) => {
            let voter = req.params.voter
            let query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            let lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                let votes = []
                for (let i = 0; i < contents.length; i++) 
                    for (let y = 0; y < contents[i].votes.length; y++) 
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                res.send(votes)
            })
        })
        // adding back this one for compatibility purpose
        // to remove in future
        app.get('/votes/:voter/:lastTs', (req, res) => {
            let voter = req.params.voter
            let query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            let lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                let votes = []
                for (let i = 0; i < contents.length; i++) 
                    for (let y = 0; y < contents[i].votes.length; y++) 
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                res.send(votes)
            })
        })

        /**
         * @api {get} /votes/pending/:voter/:lastTs Pending Votes
         * @apiName votesPending
         * @apiGroup Vote History
         * 
         * @apiParam {String} voter Username of voter
         * @apiParam {Integer} lastTs Last timestamp of votes to be queried
         * 
         * @apiSuccess {Object[]} votes Complete list of votes made by voter
         * @apiSuccess {String} votes.author Author of vote
         * @apiSuccess {String} votes.link Permlink of vote
         * @apiSuccess {Double} votes.claimable Amount claimable from vote
         * @apiSuccess {Integer} votes.vt VP spent on vote
         * @apiSuccess {Integer} votes.ts Timestamp of when the vote was casted
         * @apiSuccess {Integer} votes.contentTs Timestamp of the content being voted on
         */
        app.get('/votes/pending/:voter/:lastTs', (req, res) => {
            let voter = req.params.voter
            let claimableDate = new Date().getTime() - config.ecoClaimTime
            let query = {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        ts: { $gt: claimableDate }
                    }
                }
            }
            let lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                let votes = []
                for (let i = 0; i < contents.length; i++) 
                    for (let y = 0; y < contents[i].votes.length; y++) 
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                res.send(votes)
            })
        })

        /**
         * @api {get} /votes/claimable/:voter/:lastTs Claimable Votes
         * @apiName votesClaimable
         * @apiGroup Vote History
         * 
         * @apiParam {String} voter Username of voter
         * @apiParam {Integer} lastTs Last timestamp of votes to be queried
         * 
         * @apiSuccess {Object[]} votes Complete list of votes made by voter
         * @apiSuccess {String} votes.author Author of vote
         * @apiSuccess {String} votes.link Permlink of vote
         * @apiSuccess {Double} votes.claimable Amount claimable from vote
         * @apiSuccess {Integer} votes.vt VP spent on vote
         * @apiSuccess {Integer} votes.ts Timestamp of when the vote was casted
         * @apiSuccess {Integer} votes.contentTs Timestamp of the content being voted on
         */
        app.get('/votes/claimable/:voter/:lastTs', (req, res) => {
            let voter = req.params.voter
            let claimableDate = new Date().getTime() - config.ecoClaimTime
            let query = {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        claimable: { $gte: 1 },
                        claimed: { $exists: false },
                        ts: { $lt: claimableDate }
                    }
                }
            }
            let lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                let votes = []
                for (let i = 0; i < contents.length; i++) 
                    for (let y = 0; y < contents[i].votes.length; y++) 
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                res.send(votes)
            })
        })

        /**
         * @api {get} /votes/claimed/:voter/:lastTs Claimed Votes
         * @apiName votesClaimed
         * @apiGroup Vote History
         * 
         * @apiParam {String} voter Username of voter
         * @apiParam {Integer} lastTs Last timestamp of votes to be queried
         * 
         * @apiSuccess {Object[]} votes Complete list of votes made by voter
         * @apiSuccess {String} votes.author Author of vote
         * @apiSuccess {String} votes.link Permlink of vote
         * @apiSuccess {Double} votes.claimable Amount claimable from vote
         * @apiSuccess {Double} votes.claimed Timestamp of when the curation rewards from the vote was claimed
         * @apiSuccess {Integer} votes.vt VP spent on vote
         * @apiSuccess {Integer} votes.ts Timestamp of when the vote was casted
         * @apiSuccess {Integer} votes.contentTs Timestamp of the content being voted on
         */
        app.get('/votes/claimed/:voter/:lastTs', (req, res) => {
            let voter = req.params.voter
            let query = {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        claimable: { $gte: 1 },
                        claimed: { $exists: true }
                    }
                }
            }
            let lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                let votes = []
                for (let i = 0; i < contents.length; i++) 
                    for (let y = 0; y < contents[i].votes.length; y++) 
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                res.send(votes)
            })
        })
    }
}
