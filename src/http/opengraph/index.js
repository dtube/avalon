const ogs = require('open-graph-scraper')

module.exports = {
    init: (app) => {
        // get open graph data for any url
        /**
         * @api {get} /opengraph/:url OpenGraph
         * @apiName opengraph
         * @apiGroup External
         * 
         * @apiParam {String} url The URL to query opengraph data of
         * 
         * @apiSuccess {Object} info The opengraph data
         */
        app.get('/opengraph/:url', (req, res) => {
            if (!req.params.url) {
                res.sendStatus(500)
                return
            }
            ogs({ url: req.params.url, headers: { 'user-agent': 'facebookexternalhit/1.1 (+https://d.tube)' } }, function (error, results) {
                if (error) res.sendStatus(404)
                else res.send(results)
            })
        })
    }
}
