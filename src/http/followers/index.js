module.exports = {
    init: (app) => {
        /**
         * @api {get} /followers/:name Followers
         * @apiName followers
         * @apiGroup Follows
         * 
         * @apiParam {String} name Username to retrieve list of followers
         * 
         * @apiSuccess {String[]} accounts List of accounts that follows the username in query
         */
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
