module.exports = {
    init: (app) => {
        // look at the miner schedule
        app.get('/schedule', (req, res) => {
            res.send(chain.schedule)
        })
    }
}
