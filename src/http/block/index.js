module.exports = {
    init: (app) => {
        // fetch a single block
        app.get('/block/:number', (req, res) => {
            var blockNumber = parseInt(req.params.number)
            db.collection('blocks').findOne({ _id: blockNumber }, function (err, block) {
                if (err) throw err
                if (!block) {
                    res.sendStatus(404)
                    return
                }
                res.send(block)
            })
        })
    }
}
