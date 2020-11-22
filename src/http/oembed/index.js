const { extract } = require('oembed-parser')

module.exports = {
    init: (app) => {
        // get oembed for any url
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
