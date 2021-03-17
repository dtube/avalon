module.exports = {
    init: (app) => {
        // add data to the upcoming transactions pool
        app.post('/transact', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            transaction.isValid(tx, new Date().getTime(), function (isValid, errorMessage) {
                if (!isValid) {
                    logr.trace('invalid http tx: ', errorMessage, tx)
                    res.status(500).send({ error: errorMessage })
                } else {
                    p2p.broadcast({ t: 5, d: tx })
                    transaction.addToPool([tx])
                    res.send(chain.getLatestBlock()._id.toString())
                }
            })
        })
    }
}
