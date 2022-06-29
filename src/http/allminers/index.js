module.exports = {
    init: (app) => {
        /**
         * @api {get} /allminers Leader Full Rank
         * @apiName allminers
         * @apiGroup Leaders
         * 
         * @apiSuccess {Array} accounts List of accounts ranked by `node_appr` regardless of existence of a valid signing key.
         */
        app.get('/allminers', (req, res) => {
            db.collection('accounts').find({ node_appr: { $gt: 0 } }, {
                sort: { node_appr: -1 }
            }).toArray(function (err, accounts) {
                if (err) return res.status(500).send({ error: 'failed to fetch miners' })
                db.collection('leaders').find({ voters: { $gt: 0 } },{}).toArray((err,leaders) => {
                    if (err) return res.status(500).send({ error: 'failed to fetch leader stats' })
                    let leaderObj = {}
                    for (let i in leaders)
                        leaderObj[leaders[i]._id] = leaders[i]
                    for (let i in accounts) {
                        accounts[i].subbed = (accounts[i].follows ? accounts[i].follows.length : 0)
                        accounts[i].subs = (accounts[i].followers ? accounts[i].followers.length : 0)
                        delete accounts[i].follows
                        delete accounts[i].followers
                        delete accounts[i].keys
                        delete accounts[i].auths
                        if (leaderObj[accounts[i].name]) {
                            accounts[i].leaderStat = leaderObj[accounts[i].name]
                            delete accounts[i].leaderStat._id
                        }
                    }
                    res.send(accounts)
                })
            })
        })
    }
}
