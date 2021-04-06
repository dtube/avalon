module.exports = {
    init: (app) => {
        // get current chain config
        app.get('/config', (req, res) => {
            res.send(config)
        })
    }
}
