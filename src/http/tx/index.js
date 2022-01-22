module.exports = {
    init: (app) => {
        // tx lookup by hash
        app.get('/tx/:txhash',(req,res) => {
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