const blocks = require('../../blocks')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /block/:number Block Info
         * @apiName block
         * @apiGroup Blockchain
         * 
         * @apiParam {Integer} number Block number to query
         * 
         * @apiSuccess {Integer} _id Block identifier
         * @apiSuccess {String} phash Previous block hash
         * @apiSuccess {Integer} timestamp Block timestamp
         * @apiSuccess {Array} txs Transactions included in block
         * @apiSuccess {String} miner Producer of the block
         * @apiSuccess {String} [missedBy] Scheduled producer of the missed block
         * @apiSuccess {Double} [dist] Tokens created in block in terms of 0.01 DTUBE
         * @apiSuccess {Double} [burn] Tokens burned in block in terms of 0.01 DTUBE
         * @apiSuccess {String} hash Block hash
         * @apiSuccess {String} signature Block signature
         */
        app.get('/block/:number', (req, res) => {
            let blockNumber = parseInt(req.params.number)
            if (blocks.isOpen) {
                let block = {}
                try {
                    block = blocks.read(blockNumber)
                } catch (e) {
                    return res.status(404).send({error: e.toString()})
                }
                return res.send(block)
            }
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
