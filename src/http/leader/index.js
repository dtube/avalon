module.exports = {
    init: (app) => {
        app.get('/leader/:account',(req,res) => {
            if (!req.params.account)
                res.status(404).send({error: 'account is required'})
            db.collection('accounts').findOne({name: req.params.account}, (e,acc) => {
                if (e) return res.status(500).send(e)
                if (!acc) return res.status(404).send({error: 'account does not exist'})
                if (!leaderStats.leaders[acc.name] || (!acc.pub_leader && !leaderStats.leaders[acc.name].last))
                    return res.status(404).send({error: 'account does not have any leader-related activities'})
                res.send({
                    name: acc.name,
                    balance: acc.balance,
                    node_appr: acc.node_appr,
                    pub_leader: acc.pub_leader,
                    subs: acc.followers.length,
                    subbed: acc.follows.length,
                    sinceTs: leaderStats.leaders[acc.name].sinceTs,
                    sinceBlock: leaderStats.leaders[acc.name].sinceBlock,
                    produced: leaderStats.leaders[acc.name].produced,
                    missed: leaderStats.leaders[acc.name].missed,
                    voters: leaderStats.leaders[acc.name].voters,
                    last: leaderStats.leaders[acc.name].last
                })
            })
        })
    }
}