module.exports = {
    init: (app) => {
        /**
         * @api {get} /rewards/pending/:name Pending Rewards
         * @apiName rewardsPending
         * @apiGroup Rewards
         * 
         * @apiParam {String} name Username to query total pending rewards of
         * 
         * @apiSuccess {Integer} total Total pending rewards of account in terms of 0.01 DTUBE
         */
        app.get('/rewards/pending/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            let claimableDate = new Date().getTime() - config.ecoClaimTime
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

        /**
         * @api {get} /rewards/claimable/:name Claimable Rewards
         * @apiName rewardsClaimable
         * @apiGroup Rewards
         * 
         * @apiParam {String} name Username to query total claimable rewards of
         * 
         * @apiSuccess {Integer} total Total claimable rewards of account in terms of 0.01 DTUBE
         */
        app.get('/rewards/claimable/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            let claimableDate = new Date().getTime() - config.ecoClaimTime
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
        
        /**
         * @api {get} /rewards/claimed/:name Claimed Rewards
         * @apiName rewardsClaimed
         * @apiGroup Rewards
         * 
         * @apiParam {String} name Username to query total claimed rewards of
         * 
         * @apiSuccess {Integer} total Total claimed rewards of account in terms of 0.01 DTUBE
         */
        app.get('/rewards/claimed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({name: req.params.name}, function (err, account) {
                if (!account)
                    return res.status(404).send({error: 'account not found'})
                else if (!account.claimedReward)
                    return res.send({total: 0})
                else
                    return res.send({total: account.claimedReward})
            })
        })
    }
}
