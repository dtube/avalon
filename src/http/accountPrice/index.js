module.exports = {
    init: (app) => {
        // get username price
        app.get('/accountPrice/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            let user = req.params.name.toLowerCase()
            db.collection('accounts').findOne({ name: user }, function (err, account) {
                if (account) res.send('Not Available')
                else res.send(String(eco.accountPrice(user)))
            })
        })
    }
}
