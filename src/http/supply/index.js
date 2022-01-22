const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        // get supply info
        app.get('/supply', (req, res) => {
            let executions = [
                (cb) => db.collection('accounts').aggregate([{ $group: { _id: 0, total: { $sum: '$balance' } } }]).toArray((e, r) => cb(e, r)),
                (cb) => db.collection('contents').aggregate([{ $unwind: '$votes' }, { $match: { 'votes.claimed': { $exists: false } } }, { $group: { _id: 0, total: { $sum: '$votes.claimable' } } }]).toArray((e, r) => cb(e, r))
            ]

            parallel(executions, (e, r) => {
                if (e)
                    return res.sendStatus(500)

                var reply = {
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