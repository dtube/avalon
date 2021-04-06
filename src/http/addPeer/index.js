module.exports = {
    init: (app) => {
        // connect to a new peer
        app.post('/addPeer', (req, res) => {
            p2p.connect([req.body.peer])
            res.send()
        })
    }
}
