module.exports = {
    init: (app) => {
        // this suggests the node to produce a block and submit it
        app.get('/mineBlock', (req, res) => {
            delete p2p.recovering
            res.send(chain.getLatestBlock()._id.toString())
            chain.mineBlock(function (error, finalBlock) {
                if (error)
                    logr.error('ERROR refused block', finalBlock)
            })
        })
    }
}
