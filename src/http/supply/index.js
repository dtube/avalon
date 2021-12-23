const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /supply Supply
         * @apiName supply
         * @apiGroup Economics
         * 
         * @apiSuccess {Integer} circulating Circulating supply in user wallets that are immediately spendable
         * @apiSuccess {Double} unclaimed Unclaimed content rewards
         * @apiSuccess {Double} total Circulating supply and unclaimed rewards added
         */
        app.get('/supply', (req, res) => {
            let executions = [
                (cb) => db.collection('accounts').aggregate([{ $group: { _id: 0, total: { $sum: '$balance' } } }]).toArray((e, r) => cb(e, r)),
                (cb) => db.collection('contents').aggregate([{ $unwind: '$votes' }, { $match: { 'votes.claimed': { $exists: false } } }, { $group: { _id: 0, total: { $sum: '$votes.claimable' } } }]).toArray((e, r) => cb(e, r))
            ]

            parallel(executions, (e, r) => {
                if (e)
                    return res.sendStatus(500)

                let reply = {
                    circulating: r[0][0].total
                }
                if (r[1].length > 0) {
                    reply.unclaimed = r[1][0].total
                    reply.total = r[0][0].total + r[1][0].total
                }
                res.send(reply)
            })
        })
    }
}