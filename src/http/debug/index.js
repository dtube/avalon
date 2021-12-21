module.exports = {
    init: (app) => {
        // get in-memory data (intensive)
        app.get('/debug', (req, res) => {
            res.send({
                mempool: transaction.pool,
                consensus: {
                    possBlocks: consensus.possBlocks,
                    processed: consensus.processed,
                    validating: consensus.validating,
                },
                chain: {
                    recentBlocks: chain.recentBlocks,
                    recentTxs: chain.recentTxs
                }
            })
        })
    }
}
