const timeout_transact_async = 7500

module.exports = {
    init: (app) => {
        // add data to the upcoming transactions pool
        // and return only when the transaction is in a finalized block
        app.post('/transactWaitConfirm', (req, res) => {
            var tx = req.body
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

                    var transactTimeout = setTimeout(function () {
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
