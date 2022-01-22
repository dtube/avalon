module.exports = {
    init: (app) => {
        // pending reward per user
        app.get('/rewards/pending/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            var claimableDate = new Date().getTime() - config.ecoClaimTime
            db.collection('contents').aggregate([
                { $unwind: '$votes' },
                {
                    $match: {
                        'votes.ts': { $gte: claimableDate },
                        'votes.u': req.params.name,
                        'votes.claimed': { $exists: false }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: '$votes.claimable' } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })

        // claimable reward per user
        app.get('/rewards/claimable/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            var claimableDate = new Date().getTime() - config.ecoClaimTime
            db.collection('contents').aggregate([
                { $unwind: '$votes' },
                {
                    $match: {
                        'votes.ts': { $lt: claimableDate },
                        'votes.u': req.params.name,
                        'votes.claimed': { $exists: false }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: '$votes.claimable' } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })
        // claimed reward per user
        app.get('/rewards/claimed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('contents').aggregate([
                { $unwind: '$votes' },
                {
                    $match: {
                        'votes.u': req.params.name,
                        'votes.claimed': { $exists: true }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: '$votes.claimable' } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })
    }
}
