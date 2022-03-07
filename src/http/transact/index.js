module.exports = {
    init: (app) => {
        /**
         * @api {post} /transact Transact (Asynchronous)
         * @apiName transact
         * @apiGroup Broadcast
         * 
         * @apiBody {Object} transaction Signed transaction to be broadcasted to Avalon
         * 
         * @apiSuccess {Integer} _id The current block height
         * @apiError (Invalid Transaction Error) {String} error Error message of the invalid transaction
         */
        app.post('/transact', (req, res) => {
            let tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }

            // if the pool is already full, return 500
            if (transaction.isPoolFull())
                return res.sendStatus(500)

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
