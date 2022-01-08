module.exports = {
    init: (app) => {
        // get votes history of a user
        app.get('/votes/all/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
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
            var voter = req.params.voter
            var query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
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

        // get pending votes history of a user
        app.get('/votes/pending/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var claimableDate = new Date().getTime() - config.ecoClaimTime
            var query = {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        ts: { $gt: claimableDate }
                    }
                }
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
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

        // get claimable votes history of a user
        app.get('/votes/claimable/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var claimableDate = new Date().getTime() - config.ecoClaimTime
            var query = {
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
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
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

        // get claimed votes history of a user
        app.get('/votes/claimed/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var query = {
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
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
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
