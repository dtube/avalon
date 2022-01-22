module.exports = {
    init: (app) => {
        // get follows
        app.get('/follows/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else
                if (account.follows)
                    res.send(account.follows)
                else
                    res.send([])

            })
        })
    }
}
