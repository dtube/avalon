module.exports = {
    init: (app) => {
        // get followers
        app.get('/followers/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else
                if (account.followers)
                    res.send(account.followers)
                else
                    res.send([])
            })
        })
    }
}
