module.exports = {
    init: (app) => {
        /**
         * @api {get} /accountPrice/:name Account Price
         * @apiName accountPrice
         * @apiGroup Accounts
         * 
         * @apiParam {String} name Username to query account price of
         * 
         * @apiSuccess {Integer} price The cost to create the account of the username in terms of 0.01 DTUBE
         * @apiError (Error) {String} notAvailable When the username has already been taken
         */
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
