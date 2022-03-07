const blocks = require('../../blocks')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /count Block Height
         * @apiName count
         * @apiGroup Blockchain
         * 
         * @apiSuccess {Integer} count The current block height
         */
        app.get('/count', (req, res) => {
            if (blocks.isOpen)
                return res.send({ count: blocks.height })
            db.collection('blocks').findOne({},{ 
                sort: { _id: -1 },
                projection: { _id: 1 }
            },(err, count) => {
                if (err)
                    res.status(500).send({error: 'could not get latest block'})
                else
                    res.send({ count: count._id })
            })
        })
    }
}
