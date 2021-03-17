module.exports = {
    init: (app) => {
        // count how many blocks are in the node
        // todo: kill this endpoint and replace by /block/latest (faster execution and same result)
        app.get('/count', (req, res) => {
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
