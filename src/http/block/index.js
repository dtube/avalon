const blocks = require('../../blocks')

module.exports = {
    init: (app) => {
        // fetch a single block
        app.get('/block/:number', (req, res) => {
            let blockNumber = parseInt(req.params.number)
            if (blocks.isOpen) {
                let block = {}
                try {
                    block = blocks.read(blockNumber)
                } catch (e) {
                    return res.status(404).send({error: e})
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
