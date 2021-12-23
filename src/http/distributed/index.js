module.exports = {
    init: (app) => {
        /**
         * @api {get} /distributed/:name User Distribution
         * @apiName distributed
         * @apiGroup Economics
         * 
         * @apiParam {String} name Username to retrieve token distributions of
         * 
         * @apiSuccess {Array} distributed List of token distributions to the account
         */
        app.get('/distributed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('distributed').find({ name: req.params.name }, { sort: { ts: -1 }, limit: 200 }).toArray(function (err, distributions) {
                if (!distributions) res.sendStatus(404)
                else res.send(distributions)
            })
        })
    }
}
