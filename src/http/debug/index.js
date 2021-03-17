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
                p2p: {
                    recoveringBlocks: p2p.recoveringBlocks,
                    // recoveredBlocks: p2p.recoveredBlocks
                },
                chain: {
                    recentBlocks: chain.recentBlocks,
                    recentTxs: chain.recentTxs
                }
            })
        })
    }
}
