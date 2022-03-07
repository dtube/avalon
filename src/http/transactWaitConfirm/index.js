const timeout_transact_async = 7500

module.exports = {
    init: (app) => {
        /**
         * @api {post} /transactWaitConfirm Transact (Synchronous)
         * @apiName transactWaitConfirm
         * @apiGroup Broadcast
         * 
         * @apiBody {Object} transaction Signed transaction to be broadcasted to Avalon
         * 
         * @apiSuccess {Integer} _id The current block height
         * @apiError (Invalid Transaction Error) {String} error Error message of the invalid transaction
         */
        app.post('/transactWaitConfirm', (req, res) => {
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

                    let transactTimeout = setTimeout(function () {
                        transaction.eventConfirmation.removeListener(tx.hash, () => { })
                        res.status(408).send({ error: 'transaction timeout' })
                    }, timeout_transact_async)

                    transaction.eventConfirmation.addListener(tx.hash, function () {
                        clearTimeout(transactTimeout)
                        res.send(chain.getLatestBlock()._id.toString())
                    })
                }
            })
        })
    }
}
