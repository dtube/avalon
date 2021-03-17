module.exports = {
    init: (app) => {
        // get accounts info
        app.get('/accounts/:names', (req, res) => {
            if (!req.params.names || typeof req.params.names !== 'string') {
                res.sendStatus(500)
                return
            }
            var names = req.params.names.split(',', 100)
            db.collection('accounts').find({ name: { $in: names } }).toArray(function (err, accounts) {
                if (!accounts) res.sendStatus(404)
                else {
                    for (let i = 0; i < accounts.length; i++) {
                        accounts[i].followsCount = (accounts[i].follows ? accounts[i].follows.length : 0)
                        accounts[i].followersCount = (accounts[i].followers ? accounts[i].followers.length : 0)
                        delete accounts[i].follows
                        delete accounts[i].followers
                    }
                    res.send(accounts)
                }
            })
        })
    }
}
