module.exports = {
    init: (app) => {
        // count how many blocks are in the node
        // todo: kill this endpoint and replace by /block/latest (faster execution and same result)
        app.get('/count', (req, res) => {
            db.collection('blocks').countDocuments(function (err, count) {
                if (err) throw err
                res.send({
                    count: count
                })
            })
        })
    }
}
