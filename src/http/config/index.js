module.exports = {
    init: (app) => {
        /**
         * @api {get} /config Chain Properties
         * @apiName config
         * @apiGroup Blockchain
         * 
         * @apiSuccess {Object} config The blockchain configuration of the current hardfork.
         */
        app.get('/config', (req, res) => {
            res.send(config)
        })
    }
}
