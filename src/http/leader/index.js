module.exports = {
    init: (app) => {
        app.get('/leader/:account',(req,res) => {
            if (!req.params.account)
                res.status(404).send({error: 'account is required'})
            db.collection('accounts').findOne({name: req.params.account}, (e,acc) => {
                if (e) return res.status(500).send(e)
                if (!acc) return res.status(404).send({error: 'account does not exist'})
                if (!acc.pub_leader) return res.status(404).send({error: 'account does not contain a leader key'})
                res.send({
                    name: acc.name,
                    balance: acc.balance,
                    node_appr: acc.node_appr,
                    pub_leader: acc.pub_leader,
                    subs: acc.followers.length,
                    subbed: acc.follows.length,
                    produced: leaderStats.leaders[acc.name].produced,
                    missed: leaderStats.leaders[acc.name].missed,
                    voters: leaderStats.leaders[acc.name].voters,
                    last: leaderStats.leaders[acc.name].last
                })
            })
        })
    }
}