const { extract } = require('oembed-parser')

module.exports = {
    init: (app) => {
        // get oembed for any url
        /**
         * @api {get} /oembed/:url OEmbed
         * @apiName oembed
         * @apiGroup External
         * 
         * @apiParam {String} url The URL to query oembed data of
         * 
         * @apiSuccess {Object} info The oembed data
         */
        app.get('/oembed/:url', (req, res) => {
            if (!req.params.url) {
                res.sendStatus(500)
                return
            }
            extract(req.params.url).then((data) => {
                res.send(data)
            }).catch(() => {
                res.sendStatus(404)
            })
        })
    }
}
