module.exports = {
    init: (app) => {
        // tx lookup by hash
        app.get('/tx/:txhash',(req,res) => {
            if (process.env.TX_HISTORY === '1')
                db.collection('txs').findOne({ _id: req.params.txhash },(e,tx) => {
                    if (!tx)
                        res.status(404).send({error: 'transaction not found'})
                    else {
                        delete tx._id
                        res.send(tx)
                    }
                })
            else
                db.collection('blocks').findOne({ 'txs.hash': req.params.txhash }, { projection: { txs: { $elemMatch: { hash: req.params.txhash}}}},(error,tx) => {
                    if (error)
                        res.status(500).send(error)
                    else if (tx && tx.txs) {
                        let result = tx.txs[0]
                        result.includedInBlock = tx._id
                        res.send(result)
                    } else
                        res.status(404).send({error: 'transaction not found'})
                })
        })
    }
}