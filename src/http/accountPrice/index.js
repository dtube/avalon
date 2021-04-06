module.exports = {
    init: (app) => {
        // get username price
        app.get('/accountPrice/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (account) res.send('Not Available')
                else res.send(String(eco.accountPrice(req.params.name)))
            })
        })
    }
}
