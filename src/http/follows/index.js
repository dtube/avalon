module.exports = {
    init: (app) => {
        /**
         * @api {get} /follows/:name Followings
         * @apiName followings
         * @apiGroup Follows
         * 
         * @apiParam {String} name Username to retrieve list of followings
         * 
         * @apiSuccess {String[]} accounts List of accounts that is followed by the username in query
         */
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
