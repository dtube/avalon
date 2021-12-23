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
                if (err) throw err
                for (let i in accounts) {
                    accounts[i].followsCount = (accounts[i].follows ? accounts[i].follows.length : 0)
                    accounts[i].followersCount = (accounts[i].followers ? accounts[i].followers.length : 0)
                    delete accounts[i].follows
                    delete accounts[i].followers
                }
                res.send(accounts)
            })
        })
    }
}
