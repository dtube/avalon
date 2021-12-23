module.exports = {
    init: (app) => {
        /**
         * @api {get} /rank/:key Account Ranks
         * @apiName rank
         * @apiGroup Accounts
         * 
         * @apiParam {String} key The key to query rank by. Valid values: `balance`, `subs` and `leaders`.
         * 
         * @apiSuccess {Object[]} accounts The account rankings
         */
        app.get('/rank/:key',(req,res) => {
            let sorting = {$sort: {}}
            let projecting = {
                $project: {
                    _id: 0,
                    name: 1,
                    balance: 1,
                    subs: { $size: '$followers' },
                    subbed: { $size: '$follows' }
                }
            }
            let matching = {$match:{}}
            switch (req.params.key) {
            case 'balance':
                sorting.$sort.balance = -1
                break
            case 'subs':
                sorting.$sort.subs = -1
                break
            case 'leaders':
                if (process.env.LEADER_STATS !== '1')
                    return res.status(500).send({error: 'Leader stats module is disabled by node operator'})
                projecting.$project.node_appr = 1
                projecting.$project.pub_leader = 1
                projecting.$project.hasVote = {
                    $gt: ['$node_appr',0]
                }
                sorting.$sort.node_appr = -1
                matching.$match.hasVote = true
                matching.$match.pub_leader = { $exists: true, $ne: '' }
                break
            default:
                return res.status(400).send({error: 'invalid key'})
            }

            let aggregation = [projecting, sorting, {$limit: 100}]
            if (req.params.key === 'leaders')
                aggregation.push(matching)

            db.collection('accounts').aggregate(aggregation).toArray((e,r) => {
                if (e)
                    return res.status(500).send(e)
                if (req.params.key !== 'leaders')
                    return res.send(r)
                else {
                    for (let leader = 0; leader < r.length; leader++) {
                        delete r[leader].hasVote
                        r[leader].produced = leaderStats.leaders[r[leader].name].produced
                        r[leader].missed = leaderStats.leaders[r[leader].name].missed
                        r[leader].voters = leaderStats.leaders[r[leader].name].voters
                        r[leader].last = leaderStats.leaders[r[leader].name].last
                        if (leaderStats.leaders[r[leader].name].sinceTs) r[leader].sinceTs = leaderStats.leaders[r[leader].name].sinceTs
                        if (leaderStats.leaders[r[leader].name].sinceBlock) r[leader].sinceBlock = leaderStats.leaders[r[leader].name].sinceBlock
                    }
                    res.send(r)
                }
            })
        })
    }
}